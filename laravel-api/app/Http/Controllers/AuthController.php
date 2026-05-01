<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\UserRole;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'display_name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
            'coin_balance' => 0,
        ]);

        UserRole::firstOrCreate([
            'user_id' => $user->id,
            'role' => 'user',
        ]);

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
        ]);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::where('email', $data['email'])->first();

        if (!$user || !Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['Invalid credentials.'],
            ]);
        }

        if ($user->banned_until && $user->banned_until->isFuture()) {
            return response()->json(['message' => 'Account is banned.'], 403);
        }

        $token = $user->createToken('auth_token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->formatUser($user),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    public function user(Request $request): JsonResponse
    {
        return response()->json($this->formatUser($request->user()));
    }

    public function roles(Request $request): JsonResponse
    {
        $roles = UserRole::query()
            ->where('user_id', $request->user()->id)
            ->pluck('role')
            ->map(fn ($role) => ['role' => $role])
            ->values();

        return response()->json($roles);
    }

    public function walletBalance(Request $request): JsonResponse
    {
        return response()->json([
            'coins' => (int) $request->user()->coin_balance,
        ]);
    }

    private function formatUser(User $user): array
    {
        $roles = UserRole::query()
            ->where('user_id', $user->id)
            ->pluck('role')
            ->values()
            ->all();

        if (empty($roles)) {
            $roles = ['user'];
        }

        return [
            'id' => (string) $user->id,
            'email' => $user->email,
            'name' => $user->display_name ?: $user->name,
            'coin_balance' => (int) $user->coin_balance,
            'roles' => $roles,
        ];
    }
}
