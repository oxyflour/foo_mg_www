These files are for foobar2000 plugin foo_mg

The lua scripts runs in the mongoose server. With dumped sqlite3 database and interfaces offered by foo_mg, it can:
1. browse track by folder (browse.lua)
2. search functions (search.lua)
3. stream original or transcoded tracks (wav or mp3) to http clients (track.lua)
4. also stream other resources like booklet images or text informations (resource.lua)
The view.lua offers simple web UI for browsing and searching. Also a simple web application powered by the lua scripts is demonstrated.
