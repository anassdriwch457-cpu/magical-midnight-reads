# Research series metadata before editing the catalog

Use [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
to find official publisher pages and check a series title and author credit
before entering them in the admin editor. It provides free web search and page
fetching without a Parallel account or API key. Anonymous search uses Fast mode
and has usage limits.

This is an optional research workflow in your editor. It does not connect to the
site's database or import chapters. You need a working site and an account with
content-management access to save catalog changes through `/admin`.

## Connect from VS Code

Use VS Code with Copilot Chat and MCP support enabled. Your organization's
settings may restrict MCP servers; see the
[VS Code MCP guide](https://code.visualstudio.com/docs/copilot/customization/mcp-servers).

1. Run **MCP: Open User Configuration** from the Command Palette.
2. Add `parallel-catalog-research` inside the existing `servers` object, keeping
   your other servers. For a new configuration, use:

   ```json
   {
     "servers": {
       "parallel-catalog-research": {
         "type": "http",
         "url": "https://search.parallel.ai/mcp",
         "headers": {
           "User-Agent": "magical-midnight-reads/catalog-research"
         }
       }
     }
   }
   ```

3. Run **MCP: List Servers**, select `parallel-catalog-research`, and start it.
   Review the server trust prompt if shown. In Chat's tool picker, enable its
   `web_search` and `web_fetch` tools.
4. Start a chat in Agent mode. Ask it to use this server explicitly, and review
   tool calls before approving them. Keep this research chat limited to these
   tools so it cannot edit the catalog on your behalf.

The configuration belongs in the user profile file opened by VS Code, not in
the app's `.env`. No site credentials are needed for research. The
[HTTP configuration reference](https://code.visualstudio.com/docs/agents/reference/mcp-configuration)
describes the `type`, `url`, and `headers` fields.

## Find and verify a publisher source

Try this prompt, replacing the title and language for your catalog:

```text
Use parallel-catalog-research web_search to find the official English publisher
page for the manga Witch Hat Atelier. Confirm the series title, author credit,
and whether it is a comic or a novel. Prefer publisher sources. Distinguish the
main series from spinoffs, adaptations, and special editions. Return a table
with each proposed value, the source URL, a short supporting quote, and the
date you checked it. Mark anything unsupported as unknown. Do not write files
or change the site.
```

Search excerpts may be enough. If a credit or edition is ambiguous, ask:

```text
Use parallel-catalog-research web_fetch on
https://kodansha.us/series/witch-hat-atelier to check the exact title and creator
credit. Quote the relevant text and identify which fields remain unverified.
```

For this example, the [Kodansha series page](https://kodansha.us/series/witch-hat-atelier)
identifies **Witch Hat Atelier**, credits **Kamome Shirahama** with “By Kamome
Shirahama”, and places the series under Manga. Open the source link and check
that the evidence refers to the intended work before using it. Search can also
return the _Kitchen_ spinoff or novel adaptations with different credits.

## Apply the verified values

In `/admin`, open **Library** and select **New Series**, or edit an existing
series. The [series form](src/routes/admin.tsx) accepts:

| Editor field | What to enter                                                                                                                |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Title        | The verified title for your catalog language, such as `Witch Hat Atelier`.                                                   |
| Author       | The credited author, such as `Kamome Shirahama`. Keep writer and artist roles distinct when the source lists both.           |
| Type         | `Manga / Manhwa` for the example above; use `Novel` only for the prose work.                                                 |
| Description  | Your own concise description based on verified facts.                                                                        |
| Status       | A manually verified series status: `Ongoing`, `Completed`, or `Hiatus`. A volume's release date alone does not establish it. |

Keep source URLs, quotes, check dates, alternate titles, and separate artist or
translator credits in your editorial notes. The current form has no dedicated
source or artist input. Leave an unknown optional author blank; for an existing
record, keep uncertain values unchanged until verified. For a new series whose
type or status is uncertain, defer saving rather than accepting the defaults as
evidence. Check for an existing title or slug before creating another record.

Review the form before saving. This lookup does not supply chapter files or
cover uploads; use your existing content upload workflow for those assets.

## If research is unavailable

- If tools do not appear, check **MCP: List Servers**, its output log, and the
  Chat tool picker. Confirm that the configuration uses `servers` and
  `type: "http"` as above.
- If the free endpoint reports a usage limit, honor its retry guidance or use
  the publisher's website directly. Do not treat a failed lookup as evidence.
- If a page cannot be fetched or sources disagree, open the publisher page
  manually and retain the unresolved question in your notes.
- To stop using this workflow, stop the server or remove only its entry from
  your user configuration.
