"use strict";

const clone = require("clone");
const extend = require("extend");
const markTime = require("mark-time");

/*
  * `config`: _Object_
    * `method`: _String_ Name of method on `target` to instrument.
    * `name`: _String_ _(Default: config.method)_ Name to use for instrumentation.
    * `noContext`: _Boolean_ If `true`, do not include context in method call.
    * `target`: _Object_ Target to instrument.
    * `telemetry`: _Object_ Telemetry helpers.
      * `logs`: _Object_ `telemetry-events-log` instance.
      * `metrics`: _Object_ `telemetry-events-quantify` instance.
  * Return: _Function_ `async function(dynamic){}` Instrumented method to call.
*/
exports.async = config =>
{
    if (!config.target[config.method]
        || typeof config.target[config.method] != "function")
    {
        throw new Error(`config.target["${config.method}"] is not a function and cannot be instrumented`);
    }
    const name = config.name ? config.name : config.method;
    /*
      * `dynamic`: _Object_
        * `args`: _Array_ Arguments to call the instrumented method with.
        * `argsToLog`: _Array_ Redacted arguments to log.
        * `errorLevel`: _String_ _(Default: `error`)_ Level at which to emit log
            when error occurs.
        * `errorTraceTag`: _Boolean_ _(Default: `true`)_ If `true` and an error
            occurs, trace span will be tagged with `error = true`. No tag if set
            to `false`.
        * `metadata`: _Object_ Parent context.
        * `parentSpan`: _TraceTelemetryEvents.Span_ _(Default: \`undefined\`)_
            Parent span to inherit from if this call should be traced.
        * `targetMetadata`: _Object_ Optional target specific metadata,
            will be constructed if not provided.
        * `tenantId`: _String_ Base64url encoded tenant id.
    */
    return async dynamic =>
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
            config.telemetry.logs.log("info", `attempting ${name}`, targetMetadata,
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
            traceSpan = dynamic.parentSpan.childSpan(
                name,
                Object.assign(
                    {
                        method: config.method
                    },
                    dynamic.targetMetadata
                )
            );
        }
        const context = config.noContext ? undefined : (
                {
                    parentSpan: traceSpan,
                    provenance: dynamic.metadata.provenance,
                    tenantId: dynamic.tenantId
                }
            );
        const epilog = (error, data, startTime) =>
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
                    config.telemetry.logs.log(dynamic.errorLevel ? dynamic.errorLevel : "error", `${name} failed`, targetMetadata,
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
                    if (dynamic.errorTraceTag !== false)
                    {
                        traceSpan.tag("error", true);
                    }
                    traceSpan.finish();
                }
                throw error;
            }
            if (traceSpan)
            {
                traceSpan.finish();
            }
            return data;
        };
        const startTime = markTime();
        try
        {
            const data = await config.target[config.method](...dynamic.args, context);
            return epilog(undefined, data, startTime);
        }
        catch (error)
        {
            return epilog(error, undefined, startTime);
        }
    }
};

/*
  * `config`: _Object_
    * `method`: _String_ Name of method on `target` to instrument.
    * `name`: _String_ _(Default: config.method)_ Name to use for instrumentation.
    * `noContext`: _Boolean_ If `true`, do not include context in method call.
    * `target`: _Object_ Target to instrument.
    * `telemetry`: _Object_ Telemetry helpers.
      * `logs`: _Object_ `telemetry-events-log` instance.
      * `metrics`: _Object_ `telemetry-events-quantify` instance.
  * Return: _Function_ `function(dynamic, callback){}` Instrumented method to call.
*/
exports.sync = config =>
{
    if (!config.target[config.method]
        || typeof config.target[config.method] != "function")
    {
        throw new Error(`config.target["${config.method}"] is not a function and cannot be instrumented`);
    }
    const name = config.name ? config.name : config.method;
    /*
      * `dynamic`: _Object_
        * `args`: _Array_ Arguments to call the instrumented method with.
        * `argsToLog`: _Array_ Redacted arguments to log.
        * `errorLevel`: _String_ _(Default: `error`)_ Level at which to emit log
            when error occurs.
        * `errorTraceTag`: _Boolean_ _(Default: `true`)_ If `true` and an error
            occurs, trace span will be tagged with `error = true`. No tag if set
            to `false`.
        * `metadata`: _Object_ Parent context.
        * `parentSpan`: _TraceTelemetryEvents.Span_ _(Default: \`undefined\`)_
            Parent span to inherit from if this call should be traced.
        * `targetMetadata`: _Object_ Optional target specific metadata,
            will be constructed if not provided.
        * `tenantId`: _String_ Base64url encoded tenant id.
      * `callback`: _Function_ _(Default: undefined)_ Optional callback to use
          for error and result.
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
            config.telemetry.logs.log("info", `attempting ${name}`, targetMetadata,
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
            traceSpan = dynamic.parentSpan.childSpan(
                name,
                Object.assign(
                    {
                        method: config.method
                    },
                    dynamic.targetMetadata
                )
            );
        }
        const context = config.noContext ? undefined : (
                {
                    parentSpan: traceSpan,
                    provenance: dynamic.metadata.provenance,
                    tenantId: dynamic.tenantId
                }
            );
        const epilog = (error, data, startTime, callback) =>
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
                    config.telemetry.logs.log(dynamic.errorLevel ? dynamic.errorLevel : "error", `${name} failed`, targetMetadata,
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
                    if (dynamic.errorTraceTag !== false)
                    {
                        traceSpan.tag("error", true);
                    }
                    traceSpan.finish();
                }
                if (callback)
                {
                    return callback(error, ...data);
                }
                else
                {
                    throw error;
                }
            }
            if (traceSpan)
            {
                traceSpan.finish();
            }
            if (callback)
            {
                return callback(error, ...data);
            }
            else
            {
                return data;
            }
        };
        const startTime = markTime();
        if (typeof callback !== "function")
        {
            try
            {
                const data = config.target[config.method](...dynamic.args, context);
                return epilog(undefined, data, startTime);
            }
            catch (error)
            {
                return epilog(error, undefined, startTime);
            }
        }
        else
        {
            config.target[config.method](
                ...dynamic.args,
                (error, ...data) => epilog(error, data, startTime, callback),
                context
            );
        }
    }
};
