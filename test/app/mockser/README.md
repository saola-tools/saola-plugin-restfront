# @saola/plugin-restfront test/app/mockser

## Usage

### Run

Enable the DEBUG and full logging:

```shell
export DEBUG=framework*,app*
export LOGOLITE_DEBUGLOG_ENABLED=true
node test/app/mockser
```

Turn off the DEBUG and full logging:

```
unset DEBUG
unset LOGOLITE_DEBUGLOG_ENABLED
```

```
curl -v --request GET \
--url http://localhost:8080/example/status \
--header 'x-forwarded-host: example.com' \
--header 'X-Access-Token: origin-access-token'
```
