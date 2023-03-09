## @saola/plugin-restfront example

### Run the example

Install the dependencies of @saola/plugin-restfront:

```shell
npm install
```

Show all of log messages:

```shell
export DEBUG=saola*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
```

Start the example server:

```shell
export SAOLA_SANDBOX=old-mappings
npm run clean && npm run build && node test/app/example
```

```shell
export SAOLA_SANDBOX=new-mappings
npm run clean && npm run build && node test/app/example
```

```shell
export SAOLA_SANDBOX=new-mappings,portlets
npm run clean && npm run build && node test/app/example
```

or start the example server with mocking functions:

```shell
SAOLA_TEXTURE=mock node test/app/example
```

```shell
curl --request GET \
--header 'x-request-id: 2219b258-ed3c-4a4b-8242-d9b62e9a576d' \
--header 'x-schema-version: 1.2.0' \
--url http://localhost:7979/example/rest/sub/v2/fibonacci/calc/47
```
