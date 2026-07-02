<?php

namespace App\Http\Controllers;

use App\Models\PaymentTransaction;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;

class StripeController extends Controller
{
    public function verifyCheckout(Request $request): JsonResponse
    {
        $data = $request->validate([
            'sessionId' => ['required', 'string'],
        ]);

        $sessionId = $data['sessionId'];
        $tx = PaymentTransaction::query()->where('session_id', $sessionId)->first();

        if (!$tx) {
            return response()->json([
                'paid' => false,
                'credited' => 0,
            ]);
        }

        if ($tx->status !== 'paid') {
            return response()->json([
                'paid' => false,
                'credited' => 0,
            ]);
        }

        $alreadyCredited = $tx->credited_at !== null;
        $credited = 0;

        if (!$alreadyCredited) {
            try {
                DB::transaction(function () use ($tx, &$credited): void {
                    $transaction = PaymentTransaction::query()->lockForUpdate()->findOrFail($tx->id);
                    if ($transaction->credited_at !== null) {
                        return;
                    }

                    $user = User::query()->lockForUpdate()->findOrFail($transaction->user_id);
                    $coins = (int) $transaction->coins;
                    $user->increment('coin_balance', $coins);
                    $transaction->update([
                        'credited_at' => now(),
                    ]);
                    $credited = $coins;
                });
            } catch (\Throwable $e) {
                Log::error('[stripe] verifyCheckout transaction failed', [
                    'session_id' => $sessionId,
                    'error' => $e->getMessage(),
                ]);

                return response()->json([
                    'paid' => true,
                    'credited' => 0,
                    'error' => 'Failed to credit coins, please try again',
                ], 500);
            }
        }

        $user = User::query()->find($tx->user_id);

        return response()->json([
            'paid' => true,
            'credited' => $alreadyCredited ? (int) $tx->coins : $credited,
            'balance' => (int) ($user?->coin_balance ?? 0),
            'alreadyCredited' => $alreadyCredited,
        ]);
    }

    public function webhook(Request $request): Response
    {
        $secret = config('services.stripe.webhook_secret');
        $stripeSecret = config('services.stripe.secret');
        $payload = $request->getContent();
        $signature = $request->header('Stripe-Signature');

        if (!$secret || !$signature || !$stripeSecret) {
            return response('Missing webhook config', 400);
        }

        \Stripe\Stripe::setApiKey($stripeSecret);

        try {
            $event = \Stripe\Webhook::constructEvent($payload, $signature, $secret);
        } catch (\Throwable $e) {
            Log::warning('[stripe-webhook] signature verification failed', [
                'error' => $e->getMessage(),
            ]);

            return response('Invalid payload', 400);
        }

        if ($event->type === 'checkout.session.completed') {
            $session = $event->data->object;
            $sessionId = (string) ($session->id ?? '');
            $status = (string) ($session->payment_status ?? 'unpaid');
            $meta = (array) ($session->metadata ?? []);
            $userId = $meta['user_id'] ?? null;
            $coins = (int) ($meta['coins'] ?? 0);
            $amount = (int) ($session->amount_total ?? 0);

            if ($sessionId && $userId) {
                try {
                    PaymentTransaction::updateOrCreate(
                        ['session_id' => $sessionId],
                        [
                            'provider' => 'stripe',
                            'user_id' => $userId,
                            'amount_cents' => $amount,
                            'coins' => max(0, $coins),
                            'status' => $status === 'paid' ? 'paid' : 'pending',
                        ]
                    );
                } catch (\Throwable $e) {
                    Log::error('[stripe-webhook] failed to record transaction', [
                        'session_id' => $sessionId,
                        'error' => $e->getMessage(),
                    ]);

                    return response('Failed to record transaction', 500);
                }
            }
        }

        return response('ok', 200);
    }
}
