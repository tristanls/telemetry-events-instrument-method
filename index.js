"use strict";

const clone = require("clone");
const extend = require("extend");
const markTime = require("mark-time");

/*
  * `config`: _Object_
    * `method`: _String_ Name of method on `target` to instrument.
    * `target`: _Object_ Target to instrument.
    * `telemetry`: _Object_ Telemetry helpers.
      * `logs`: _Object_ `telemetry-events-log` instance.
      * `metrics`: _Object_ `telemetry-events-quantify` instance.
  * Return: _Function_ `function(dynamic, callback){}` Instrumented method to call.
*/
module.exports = config =>
{
    /*
      * `dynamic`: _Object_
        * `args`: _Array_ Arguments to call the instrumented method with.
        * `argsToLog`: _Array_ Redacted arguments to log.
        * `metadata`: _Object_ Parent context.
        * `targetMetadata`: _Object_ Optional target specific metadata,
            will be constructed if not provided.
        * `parentSpan`: _TraceTelemetryEvents.Span_ _(Default: \`undefined\`)_
            Parent span to inherit from if this call should be traced.
        * `tenantId`: _String_ Base64url encoded tenant id.
      * `callback`: _Function_ Callback to use for error and result.
    */
    return (dynamic, callback) =>
    {
        dynamic.targetMetadata = dynamic.targetMetadata ||
        {
            module: config.target.name,
            version: config.target.version
        };
        const targetMetadata = extend(true, clone(dynamic.metadata),
            {
                target:
                {
                    method: config.method
                }
            },
            {
                target: dynamic.targetMetadata
            }
        );
        if (config.telemetry && config.telemetry.logs)
        {
            config.telemetry.logs.log("info", `attempting ${config.method}`, targetMetadata,
                {
                    target:
                    {
                        args: dynamic.argsToLog
                    }
                }
            );
        }
        let traceSpan;
        if (dynamic.parentSpan)
        {
            traceSpan = dynamic.parentSpan.childSpan(config.method, dynamic.targetMetadata);
        }
        const startTime = markTime();
        config.target[config.method](...dynamic.args, (error, ...data) =>
            {
                const elapsedTime = markTime() - startTime;
                if (config.telemetry && config.telemetry.metrics)
                {
                    config.telemetry.metrics.gauge("latency",
                        {
                            unit: "ms",
                            value: elapsedTime,
                            metadata: clone(targetMetadata)
                        }
                    );
                }
                if (error)
                {
                    if (config.telemetry && config.telemetry.logs)
                    {
                        config.telemetry.logs.log("error", `${config.method} failed`, targetMetadata,
                            {
                                target:
                                {
                                    args: dynamic.argsToLog
                                },
                                error,
                                stack: error.stack
                            }
                        );
                    }
                    if (traceSpan)
                    {
                        traceSpan.tag("error", true);
                        traceSpan.finish();
                    }
                    return callback(error, ...data);
                }
                if (traceSpan)
                {
                    traceSpan.finish();
                }
                return callback(error, ...data);
            },
            {
                parentSpan: traceSpan,
                provenance: dynamic.metadata.provenance,
                tenantId: dynamic.tenantId
            }
        );
    }
};
