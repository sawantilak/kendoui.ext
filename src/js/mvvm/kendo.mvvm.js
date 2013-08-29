/*
* Kendo UI Beta v2013.2.716 (http://kendoui.com)
* Copyright 2013 Telerik AD. All rights reserved.
*
* Kendo UI Beta license terms available at
* http://www.kendoui.com/purchase/license-agreement/kendo-ui-beta.aspx
*/

(function($, evil, undefined) {
    var kendo = window.kendo = window.kendo || {},
        extend = $.extend,
        each = $.each,
        proxy = $.proxy,
        isArray = $.isArray,
        noop = $.noop,
        isFunction = $.isFunction,
        math = Math,
        Template,
        JSON = window.JSON || {},
        support = {},
        percentRegExp = /%/,
        formatRegExp = /\{(\d+)(:[^\}]+)?\}/g,
        boxShadowRegExp = /(\d+?)px\s*(\d+?)px\s*(\d+?)px\s*(\d+?)?/i,
        numberRegExp = /^(\+|-?)\d+(\.?)\d*$/,
        FUNCTION = "function",
        STRING = "string",
        NUMBER = "number",
        OBJECT = "object",
        NULL = "null",
        BOOLEAN = "boolean",
        UNDEFINED = "undefined",
        getterCache = {},
        setterCache = {},
        slice = [].slice,
        globalize = window.Globalize;

    kendo.version = "2013.2.716";

    function Class() {}

    Class.extend = function(proto) {
        var base = function() {},
            member,
            that = this,
            subclass = proto && proto.init ? proto.init : function () {
                that.apply(this, arguments);
            },
            fn;

        base.prototype = that.prototype;
        fn = subclass.fn = subclass.prototype = new base();

        for (member in proto) {
            if (typeof proto[member] === OBJECT && !(proto[member] instanceof Array) && proto[member] !== null) {
                // Merge object members
                fn[member] = extend(true, {}, base.prototype[member], proto[member]);
            } else {
                fn[member] = proto[member];
            }
        }

        fn.constructor = subclass;
        subclass.extend = that.extend;

        return subclass;
    };

    var preventDefault = function() {
        this._defaultPrevented = true;
    };

    var isDefaultPrevented = function() {
        return this._defaultPrevented === true;
    };

    var Observable = Class.extend({
        init: function() {
            this._events = {};
        },

        bind: function(eventName, handlers, one) {
            var that = this,
                idx,
                eventNames = typeof eventName === STRING ? [eventName] : eventName,
                length,
                original,
                handler,
                handlersIsFunction = typeof handlers === FUNCTION,
                events;

            if (handlers === undefined) {
                for (idx in eventName) {
                    that.bind(idx, eventName[idx]);
                }
                return that;
            }

            for (idx = 0, length = eventNames.length; idx < length; idx++) {
                eventName = eventNames[idx];

                handler = handlersIsFunction ? handlers : handlers[eventName];

                if (handler) {
                    if (one) {
                        original = handler;
                        handler = function() {
                            that.unbind(eventName, handler);
                            original.apply(that, arguments);
                        };
                    }
                    events = that._events[eventName] = that._events[eventName] || [];
                    events.push(handler);
                }
            }

            return that;
        },

        one: function(eventNames, handlers) {
            return this.bind(eventNames, handlers, true);
        },

        first: function(eventName, handlers) {
            var that = this,
                idx,
                eventNames = typeof eventName === STRING ? [eventName] : eventName,
                length,
                handler,
                handlersIsFunction = typeof handlers === FUNCTION,
                events;

            for (idx = 0, length = eventNames.length; idx < length; idx++) {
                eventName = eventNames[idx];

                handler = handlersIsFunction ? handlers : handlers[eventName];

                if (handler) {
                    events = that._events[eventName] = that._events[eventName] || [];
                    events.unshift(handler);
                }
            }

            return that;
        },

        trigger: function(eventName, e) {
            var that = this,
                events = that._events[eventName],
                idx,
                length;

            if (events) {
                e = e || {};

                e.sender = that;

                e._defaultPrevented = false;

                e.preventDefault = preventDefault;

                e.isDefaultPrevented = isDefaultPrevented;

                events = events.slice();

                for (idx = 0, length = events.length; idx < length; idx++) {
                    events[idx].call(that, e);
                }

                return e._defaultPrevented === true;
            }

            return false;
        },

        unbind: function(eventName, handler) {
            var that = this,
                events = that._events[eventName],
                idx;

            if (eventName === undefined) {
                that._events = {};
            } else if (events) {
                if (handler) {
                    for (idx = events.length - 1; idx >= 0; idx--) {
                        if (events[idx] === handler) {
                            events.splice(idx, 1);
                        }
                    }
                } else {
                    that._events[eventName] = [];
                }
            }

            return that;
        }
    });


     function compilePart(part, stringPart) {
         if (stringPart) {
             return "'" +
                 part.split("'").join("\\'")
                     .split('\\"').join('\\\\\\"')
                     .replace(/\n/g, "\\n")
                     .replace(/\r/g, "\\r")
                     .replace(/\t/g, "\\t") + "'";
         } else {
             var first = part.charAt(0),
                 rest = part.substring(1);

             if (first === "=") {
                 return "+(" + rest + ")+";
             } else if (first === ":") {
                 return "+e(" + rest + ")+";
             } else {
                 return ";" + part + ";o+=";
             }
         }
     }

    var argumentNameRegExp = /^\w+/,
        encodeRegExp = /\$\{([^}]*)\}/g,
        escapedCurlyRegExp = /\\\}/g,
        curlyRegExp = /__CURLY__/g,
        escapedSharpRegExp = /\\#/g,
        sharpRegExp = /__SHARP__/g,
        zeros = ["", "0", "00", "000", "0000"];

    Template = {
        paramName: "data", // name of the parameter of the generated template
        useWithBlock: true, // whether to wrap the template in a with() block
        render: function(template, data) {
            var idx,
                length,
                html = "";

            for (idx = 0, length = data.length; idx < length; idx++) {
                html += template(data[idx]);
            }

            return html;
        },
        compile: function(template, options) {
            var settings = extend({}, this, options),
                paramName = settings.paramName,
                argumentName = paramName.match(argumentNameRegExp)[0],
                useWithBlock = settings.useWithBlock,
                functionBody = "var o,e=kendo.htmlEncode;",
                fn,
                parts,
                idx;

            if (isFunction(template)) {
                if (template.length === 2) {
                    //looks like jQuery.template
                    return function(d) {
                        return template($, { data: d }).join("");
                    };
                }
                return template;
            }

            functionBody += useWithBlock ? "with(" + paramName + "){" : "";

            functionBody += "o=";

            parts = template
                .replace(escapedCurlyRegExp, "__CURLY__")
                .replace(encodeRegExp, "#=e($1)#")
                .replace(curlyRegExp, "}")
                .replace(escapedSharpRegExp, "__SHARP__")
                .split("#");

            for (idx = 0; idx < parts.length; idx ++) {
                functionBody += compilePart(parts[idx], idx % 2 === 0);
            }

            functionBody += useWithBlock ? ";}" : ";";

            functionBody += "return o;";

            functionBody = functionBody.replace(sharpRegExp, "#");

            try {
                fn = new Function(argumentName, functionBody);
                fn._slotCount = Math.floor(parts.length / 2);
                return fn;
            } catch(e) {
                throw new Error(kendo.format("Invalid template:'{0}' Generated code:'{1}'", template, functionBody));
            }
        }
    };

function pad(number, digits, end) {
    number = number + "";
    digits = digits || 2;
    end = digits - number.length;

    if (end) {
        return zeros[digits].substring(0, end) + number;
    }

    return number;
}

    //JSON stringify
(function() {
    var escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {
            "\b": "\\b",
            "\t": "\\t",
            "\n": "\\n",
            "\f": "\\f",
            "\r": "\\r",
            "\"" : '\\"',
            "\\": "\\\\"
        },
        rep,
        toString = {}.toString;

    if (typeof Date.prototype.toJSON !== FUNCTION) {

        Date.prototype.toJSON = function () {
            var that = this;

            return isFinite(that.valueOf()) ?
                pad(that.getUTCFullYear(), 4) + "-" +
                pad(that.getUTCMonth() + 1)   + "-" +
                pad(that.getUTCDate())        + "T" +
                pad(that.getUTCHours())       + ":" +
                pad(that.getUTCMinutes())     + ":" +
                pad(that.getUTCSeconds())     + "Z" : null;
        };

        String.prototype.toJSON = Number.prototype.toJSON = Boolean.prototype.toJSON = function () {
            return this.valueOf();
        };
    }

    function quote(string) {
        escapable.lastIndex = 0;
        return escapable.test(string) ? "\"" + string.replace(escapable, function (a) {
            var c = meta[a];
            return typeof c === STRING ? c :
                "\\u" + ("0000" + a.charCodeAt(0).toString(16)).slice(-4);
        }) + "\"" : "\"" + string + "\"";
    }

    function str(key, holder) {
        var i,
            k,
            v,
            length,
            mind = gap,
            partial,
            value = holder[key],
            type;

        if (value && typeof value === OBJECT && typeof value.toJSON === FUNCTION) {
            value = value.toJSON(key);
        }

        if (typeof rep === FUNCTION) {
            value = rep.call(holder, key, value);
        }

        type = typeof value;
        if (type === STRING) {
            return quote(value);
        } else if (type === NUMBER) {
            return isFinite(value) ? String(value) : NULL;
        } else if (type === BOOLEAN || type === NULL) {
            return String(value);
        } else if (type === OBJECT) {
            if (!value) {
                return NULL;
            }
            gap += indent;
            partial = [];
            if (toString.apply(value) === "[object Array]") {
                length = value.length;
                for (i = 0; i < length; i++) {
                    partial[i] = str(i, value) || NULL;
                }
                v = partial.length === 0 ? "[]" : gap ?
                    "[\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "]" :
                    "[" + partial.join(",") + "]";
                gap = mind;
                return v;
            }
            if (rep && typeof rep === OBJECT) {
                length = rep.length;
                for (i = 0; i < length; i++) {
                    if (typeof rep[i] === STRING) {
                        k = rep[i];
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ": " : ":") + v);
                        }
                    }
                }
            } else {
                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ": " : ":") + v);
                        }
                    }
                }
            }

            v = partial.length === 0 ? "{}" : gap ?
                "{\n" + gap + partial.join(",\n" + gap) + "\n" + mind + "}" :
                "{" + partial.join(",") + "}";
            gap = mind;
            return v;
        }
    }

    if (typeof JSON.stringify !== FUNCTION) {
        JSON.stringify = function (value, replacer, space) {
            var i;
            gap = "";
            indent = "";

            if (typeof space === NUMBER) {
                for (i = 0; i < space; i += 1) {
                    indent += " ";
                }

            } else if (typeof space === STRING) {
                indent = space;
            }

            rep = replacer;
            if (replacer && typeof replacer !== FUNCTION && (typeof replacer !== OBJECT || typeof replacer.length !== NUMBER)) {
                throw new Error("JSON.stringify");
            }

            return str("", {"": value});
        };
    }
})();

// Date and Number formatting
(function() {
    var dateFormatRegExp = /dddd|ddd|dd|d|MMMM|MMM|MM|M|yyyy|yy|HH|H|hh|h|mm|m|fff|ff|f|tt|ss|s|"[^"]*"|'[^']*'/g,
        standardFormatRegExp =  /^(n|c|p|e)(\d*)$/i,
        literalRegExp = /(\\.)|(['][^']*[']?)|(["][^"]*["]?)/g,
        commaRegExp = /\,/g,
        EMPTY = "",
        POINT = ".",
        COMMA = ",",
        SHARP = "#",
        ZERO = "0",
        PLACEHOLDER = "??",
        EN = "en-US",
        objectToString = {}.toString;

    //cultures
    kendo.cultures = {"en-US" : {
        name: EN,
        numberFormat: {
            pattern: ["-n"],
            decimals: 2,
            ",": ",",
            ".": ".",
            groupSize: [3],
            percent: {
                pattern: ["-n %", "n %"],
                decimals: 2,
                ",": ",",
                ".": ".",
                groupSize: [3],
                symbol: "%"
            },
            currency: {
                pattern: ["($n)", "$n"],
                decimals: 2,
                ",": ",",
                ".": ".",
                groupSize: [3],
                symbol: "$"
            }
        },
        calendars: {
            standard: {
                days: {
                    names: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
                    namesAbbr: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
                    namesShort: [ "Su", "Mo", "Tu", "We", "Th", "Fr", "Sa" ]
                },
                months: {
                    names: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
                    namesAbbr: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
                },
                AM: [ "AM", "am", "AM" ],
                PM: [ "PM", "pm", "PM" ],
                patterns: {
                    d: "M/d/yyyy",
                    D: "dddd, MMMM dd, yyyy",
                    F: "dddd, MMMM dd, yyyy h:mm:ss tt",
                    g: "M/d/yyyy h:mm tt",
                    G: "M/d/yyyy h:mm:ss tt",
                    m: "MMMM dd",
                    M: "MMMM dd",
                    s: "yyyy'-'MM'-'ddTHH':'mm':'ss",
                    t: "h:mm tt",
                    T: "h:mm:ss tt",
                    u: "yyyy'-'MM'-'dd HH':'mm':'ss'Z'",
                    y: "MMMM, yyyy",
                    Y: "MMMM, yyyy"
                },
                "/": "/",
                ":": ":",
                firstDay: 0,
                twoDigitYearMax: 2029
            }
        }
    }};


     function findCulture(culture) {
        if (culture) {
            if (culture.numberFormat) {
                return culture;
            }

            if (typeof culture === STRING) {
                var cultures = kendo.cultures;
                return cultures[culture] || cultures[culture.split("-")[0]] || null;
            }

            return null;
        }

        return null;
    }

    function getCulture(culture) {
        if (culture) {
            culture = findCulture(culture);
        }

        return culture || kendo.cultures.current;
    }

    function expandNumberFormat(numberFormat) {
        numberFormat.groupSizes = numberFormat.groupSize;
        numberFormat.percent.groupSizes = numberFormat.percent.groupSize;
        numberFormat.currency.groupSizes = numberFormat.currency.groupSize;
    }

    kendo.culture = function(cultureName) {
        var cultures = kendo.cultures, culture;

        if (cultureName !== undefined) {
            culture = findCulture(cultureName) || cultures[EN];
            culture.calendar = culture.calendars.standard;
            cultures.current = culture;

            if (globalize) {
                expandNumberFormat(culture.numberFormat);
            }

        } else {
            return cultures.current;
        }
    };

    kendo.findCulture = findCulture;
    kendo.getCulture = getCulture;

    //set current culture to en-US.
    kendo.culture(EN);

    function formatDate(date, format, culture) {
        culture = getCulture(culture);

        var calendar = culture.calendars.standard,
            days = calendar.days,
            months = calendar.months;

        format = calendar.patterns[format] || format;

        return format.replace(dateFormatRegExp, function (match) {
            var result;

            if (match === "d") {
                result = date.getDate();
            } else if (match === "dd") {
                result = pad(date.getDate());
            } else if (match === "ddd") {
                result = days.namesAbbr[date.getDay()];
            } else if (match === "dddd") {
                result = days.names[date.getDay()];
            } else if (match === "M") {
                result = date.getMonth() + 1;
            } else if (match === "MM") {
                result = pad(date.getMonth() + 1);
            } else if (match === "MMM") {
                result = months.namesAbbr[date.getMonth()];
            } else if (match === "MMMM") {
                result = months.names[date.getMonth()];
            } else if (match === "yy") {
                result = pad(date.getFullYear() % 100);
            } else if (match === "yyyy") {
                result = pad(date.getFullYear(), 4);
            } else if (match === "h" ) {
                result = date.getHours() % 12 || 12;
            } else if (match === "hh") {
                result = pad(date.getHours() % 12 || 12);
            } else if (match === "H") {
                result = date.getHours();
            } else if (match === "HH") {
                result = pad(date.getHours());
            } else if (match === "m") {
                result = date.getMinutes();
            } else if (match === "mm") {
                result = pad(date.getMinutes());
            } else if (match === "s") {
                result = date.getSeconds();
            } else if (match === "ss") {
                result = pad(date.getSeconds());
            } else if (match === "f") {
                result = math.floor(date.getMilliseconds() / 100);
            } else if (match === "ff") {
                result = math.floor(date.getMilliseconds() / 10);
            } else if (match === "fff") {
                result = date.getMilliseconds();
            } else if (match === "tt") {
                result = date.getHours() < 12 ? calendar.AM[0] : calendar.PM[0];
            }

            return result !== undefined ? result : match.slice(1, match.length - 1);
        });
    }

    //number formatting
    function formatNumber(number, format, culture) {
        culture = getCulture(culture);

        var numberFormat = culture.numberFormat,
            groupSize = numberFormat.groupSize[0],
            groupSeparator = numberFormat[COMMA],
            decimal = numberFormat[POINT],
            precision = numberFormat.decimals,
            pattern = numberFormat.pattern[0],
            literals = [],
            symbol,
            isCurrency, isPercent,
            customPrecision,
            formatAndPrecision,
            negative = number < 0,
            integer,
            fraction,
            integerLength,
            fractionLength,
            replacement = EMPTY,
            value = EMPTY,
            idx,
            length,
            ch,
            hasGroup,
            hasNegativeFormat,
            decimalIndex,
            sharpIndex,
            zeroIndex,
            hasZero, hasSharp,
            percentIndex,
            currencyIndex,
            startZeroIndex,
            start = -1,
            end;

        //return empty string if no number
        if (number === undefined) {
            return EMPTY;
        }

        if (!isFinite(number)) {
            return number;
        }

        //if no format then return number.toString() or number.toLocaleString() if culture.name is not defined
        if (!format) {
            return culture.name.length ? number.toLocaleString() : number.toString();
        }

        formatAndPrecision = standardFormatRegExp.exec(format);

        // standard formatting
        if (formatAndPrecision) {
            format = formatAndPrecision[1].toLowerCase();

            isCurrency = format === "c";
            isPercent = format === "p";

            if (isCurrency || isPercent) {
                //get specific number format information if format is currency or percent
                numberFormat = isCurrency ? numberFormat.currency : numberFormat.percent;
                groupSize = numberFormat.groupSize[0];
                groupSeparator = numberFormat[COMMA];
                decimal = numberFormat[POINT];
                precision = numberFormat.decimals;
                symbol = numberFormat.symbol;
                pattern = numberFormat.pattern[negative ? 0 : 1];
            }

            customPrecision = formatAndPrecision[2];

            if (customPrecision) {
                precision = +customPrecision;
            }

            //return number in exponential format
            if (format === "e") {
                return customPrecision ? number.toExponential(precision) : number.toExponential(); // toExponential() and toExponential(undefined) differ in FF #653438.
            }

            // multiply if format is percent
            if (isPercent) {
                number *= 100;
            }

            number = round(number, precision);
            number = number.split(POINT);

            integer = number[0];
            fraction = number[1];

            //exclude "-" if number is negative.
            if (negative) {
                integer = integer.substring(1);
            }

            value = integer;
            integerLength = integer.length;

            //add group separator to the number if it is longer enough
            if (integerLength >= groupSize) {
                value = EMPTY;
                for (idx = 0; idx < integerLength; idx++) {
                    if (idx > 0 && (integerLength - idx) % groupSize === 0) {
                        value += groupSeparator;
                    }
                    value += integer.charAt(idx);
                }
            }

            if (fraction) {
                value += decimal + fraction;
            }

            if (format === "n" && !negative) {
                return value;
            }

            number = EMPTY;

            for (idx = 0, length = pattern.length; idx < length; idx++) {
                ch = pattern.charAt(idx);

                if (ch === "n") {
                    number += value;
                } else if (ch === "$" || ch === "%") {
                    number += symbol;
                } else {
                    number += ch;
                }
            }

            return number;
        }

        //custom formatting
        //
        //separate format by sections.

        //make number positive
        if (negative) {
            number = -number;
        }

        /*if (format.indexOf("'") > -1 || format.indexOf("\"") > -1) {
            format = format.replace(literalRegExp, function(match) {
                literals.push(match.substring(1, match.length - 1));
                return PLACEHOLDER;
            });
        }*/

        if (format.indexOf("'") > -1 || format.indexOf("\"") > -1 || format.indexOf("\\") > -1) {
            format = format.replace(literalRegExp, function (match) {
                var quoteChar = match.charAt(0).replace("\\", ""),
                    literal = match.slice(1).replace(quoteChar, "");

                literals.push(literal);

                return PLACEHOLDER;
            });
        }

        format = format.split(";");
        if (negative && format[1]) {
            //get negative format
            format = format[1];
            hasNegativeFormat = true;
        } else if (number === 0) {
            //format for zeros
            format = format[2] || format[0];
            if (format.indexOf(SHARP) == -1 && format.indexOf(ZERO) == -1) {
                //return format if it is string constant.
                return format;
            }
        } else {
            format = format[0];
        }

        percentIndex = format.indexOf("%");
        currencyIndex = format.indexOf("$");

        isPercent = percentIndex != -1;
        isCurrency = currencyIndex != -1;

        //multiply number if the format has percent
        if (isPercent) {
            number *= 100;
        }

        if (isCurrency && format[currencyIndex - 1] === "\\") {
            format = format.split("\\").join("");
            isCurrency = false;
        }

        if (isCurrency || isPercent) {
            //get specific number format information if format is currency or percent
            numberFormat = isCurrency ? numberFormat.currency : numberFormat.percent;
            groupSize = numberFormat.groupSize[0];
            groupSeparator = numberFormat[COMMA];
            decimal = numberFormat[POINT];
            precision = numberFormat.decimals;
            symbol = numberFormat.symbol;
        }

        hasGroup = format.indexOf(COMMA) > -1;
        if (hasGroup) {
            format = format.replace(commaRegExp, EMPTY);
        }

        decimalIndex = format.indexOf(POINT);
        length = format.length;

        if (decimalIndex != -1) {
            fraction = number.toString().split("e");
            if (fraction[1]) {
                fraction = round(number, Math.abs(fraction[1]));
            } else {
                fraction = fraction[0];
            }
            fraction = fraction.split(POINT)[1] || EMPTY;
            zeroIndex = format.lastIndexOf(ZERO) - decimalIndex;
            sharpIndex = format.lastIndexOf(SHARP) - decimalIndex;
            hasZero = zeroIndex > -1;
            hasSharp = sharpIndex > -1;
            idx = fraction.length;

            if (!hasZero && !hasSharp) {
                format = format.substring(0, decimalIndex) + format.substring(decimalIndex + 1);
                length = format.length;
                decimalIndex = -1;
                idx = 0;
            } if (hasZero && zeroIndex > sharpIndex) {
                idx = zeroIndex;
            } else if (sharpIndex > zeroIndex) {
                if (hasSharp && idx > sharpIndex) {
                    idx = sharpIndex;
                } else if (hasZero && idx < zeroIndex) {
                    idx = zeroIndex;
                }
            }

            if (idx > -1) {
                number = round(number, idx);
            }
        } else {
            number = round(number);
        }

        sharpIndex = format.indexOf(SHARP);
        startZeroIndex = zeroIndex = format.indexOf(ZERO);

        //define the index of the first digit placeholder
        if (sharpIndex == -1 && zeroIndex != -1) {
            start = zeroIndex;
        } else if (sharpIndex != -1 && zeroIndex == -1) {
            start = sharpIndex;
        } else {
            start = sharpIndex > zeroIndex ? zeroIndex : sharpIndex;
        }

        sharpIndex = format.lastIndexOf(SHARP);
        zeroIndex = format.lastIndexOf(ZERO);

        //define the index of the last digit placeholder
        if (sharpIndex == -1 && zeroIndex != -1) {
            end = zeroIndex;
        } else if (sharpIndex != -1 && zeroIndex == -1) {
            end = sharpIndex;
        } else {
            end = sharpIndex > zeroIndex ? sharpIndex : zeroIndex;
        }

        if (start == length) {
            end = start;
        }

        if (start != -1) {
            value = number.toString().split(POINT);
            integer = value[0];
            fraction = value[1] || EMPTY;

            integerLength = integer.length;
            fractionLength = fraction.length;

            //add group separator to the number if it is longer enough
            if (hasGroup) {
                if (integerLength === groupSize && integerLength < decimalIndex - startZeroIndex) {
                    integer = groupSeparator + integer;
                } else if (integerLength > groupSize) {
                    value = EMPTY;
                    for (idx = 0; idx < integerLength; idx++) {
                        if (idx > 0 && (integerLength - idx) % groupSize === 0) {
                            value += groupSeparator;
                        }
                        value += integer.charAt(idx);
                    }

                    integer = value;
                }
            }

            number = format.substring(0, start);

            if (negative && !hasNegativeFormat) {
                number += "-";
            }

            for (idx = start; idx < length; idx++) {
                ch = format.charAt(idx);

                if (decimalIndex == -1) {
                    if (end - idx < integerLength) {
                        number += integer;
                        break;
                    }
                } else {
                    if (zeroIndex != -1 && zeroIndex < idx) {
                        replacement = EMPTY;
                    }

                    if ((decimalIndex - idx) <= integerLength && decimalIndex - idx > -1) {
                        number += integer;
                        idx = decimalIndex;
                    }

                    if (decimalIndex === idx) {
                        number += (fraction ? decimal : EMPTY) + fraction;
                        idx += end - decimalIndex + 1;
                        continue;
                    }
                }

                if (ch === ZERO) {
                    number += ch;
                    replacement = ch;
                } else if (ch === SHARP) {
                    number += replacement;
                }
            }

            if (end >= start) {
                number += format.substring(end + 1);
            }

            //replace symbol placeholders
            if (isCurrency || isPercent) {
                value = EMPTY;
                for (idx = 0, length = number.length; idx < length; idx++) {
                    ch = number.charAt(idx);
                    value += (ch === "$" || ch === "%") ? symbol : ch;
                }
                number = value;
            }

            length = literals.length;

            if (length) {
                for (idx = 0; idx < length; idx++) {
                    number = number.replace(PLACEHOLDER, literals[idx]);
                }
            }
        }

        return number;
    }

    var round = function(value, precision) {
        var power = Math.pow(10, precision || 0);
        return (Math.round(value * power) / power).toFixed(precision);
    };

    var toString = function(value, fmt, culture) {
        if (fmt) {
            if (objectToString.call(value) === "[object Date]") {
                return formatDate(value, fmt, culture);
            } else if (typeof value === NUMBER) {
                return formatNumber(value, fmt, culture);
            }
        }

        return value !== undefined ? value : "";
    };

    if (globalize) {
        toString = proxy(globalize.format, globalize);
    }

    kendo.format = function(fmt) {
        var values = arguments;

        return fmt.replace(formatRegExp, function(match, index, placeholderFormat) {
            var value = values[parseInt(index, 10) + 1];

            return toString(value, placeholderFormat ? placeholderFormat.substring(1) : "");
        });
    };

    kendo._extractFormat = function (format) {
        if (format.slice(0,3) === "{0:") {
            format = format.slice(3, format.length - 1);
        }

        return format;
    };

    kendo._activeElement = function() {
        try {
            return document.activeElement;
        } catch(e) {
            return document.documentElement.activeElement;
        }
    };

    kendo._round = round;
    kendo.toString = toString;
})();


(function() {
    var nonBreakingSpaceRegExp = /\u00A0/g,
        exponentRegExp = /[eE][\-+]?[0-9]+/,
        shortTimeZoneRegExp = /[+|\-]\d{1,2}/,
        longTimeZoneRegExp = /[+|\-]\d{1,2}:\d{2}/,
        dateRegExp = /^\/Date\((.*?)\)\/$/,
        formatsSequence = ["G", "g", "d", "F", "D", "y", "m", "T", "t"],
        numberRegExp = {
            2: /^\d{1,2}/,
            4: /^\d{4}/
        },
        objectToString = {}.toString;

    function outOfRange(value, start, end) {
        return !(value >= start && value <= end);
    }

    function designatorPredicate(designator) {
        return designator.charAt(0);
    }

    function mapDesignators(designators) {
        return $.map(designators, designatorPredicate);
    }

    //if date's day is different than the typed one - adjust
    function adjustDST(date, hours) {
        if (!hours && date.getHours() === 23) {
            date.setHours(date.getHours() + 2);
        }
    }

    function lowerArray(data) {
        var idx = 0,
            length = data.length,
            array = [];

        for (; idx < length; idx++) {
            array[idx] = (data[idx] + "").toLowerCase();
        }

        return array;
    }

    function lowerLocalInfo(localInfo) {
        var newLocalInfo = {}, property;

        for (property in localInfo) {
            newLocalInfo[property] = lowerArray(localInfo[property]);
        }

        return newLocalInfo;
    }

    function parseExact(value, format, culture) {
        if (!value) {
            return null;
        }

        var lookAhead = function (match) {
                var i = 0;
                while (format[idx] === match) {
                    i++;
                    idx++;
                }
                if (i > 0) {
                    idx -= 1;
                }
                return i;
            },
            getNumber = function(size) {
                var rg = numberRegExp[size] || new RegExp('^\\d{1,' + size + '}'),
                    match = value.substr(valueIdx, size).match(rg);

                if (match) {
                    match = match[0];
                    valueIdx += match.length;
                    return parseInt(match, 10);
                }
                return null;
            },
            getIndexByName = function (names, lower) {
                var i = 0,
                    length = names.length,
                    name, nameLength,
                    subValue;

                for (; i < length; i++) {
                    name = names[i];
                    nameLength = name.length;
                    subValue = value.substr(valueIdx, nameLength);

                    if (lower) {
                        subValue = subValue.toLowerCase();
                    }

                    if (subValue == name) {
                        valueIdx += nameLength;
                        return i + 1;
                    }
                }
                return null;
            },
            checkLiteral = function() {
                var result = false;
                if (value.charAt(valueIdx) === format[idx]) {
                    valueIdx++;
                    result = true;
                }
                return result;
            },
            calendar = culture.calendars.standard,
            year = null,
            month = null,
            day = null,
            hours = null,
            minutes = null,
            seconds = null,
            milliseconds = null,
            idx = 0,
            valueIdx = 0,
            literal = false,
            date = new Date(),
            twoDigitYearMax = calendar.twoDigitYearMax || 2029,
            defaultYear = date.getFullYear(),
            ch, count, length, pattern,
            pmHour, UTC, ISO8601, matches,
            amDesignators, pmDesignators,
            hoursOffset, minutesOffset;

        if (!format) {
            format = "d"; //shord date format
        }

        //if format is part of the patterns get real format
        pattern = calendar.patterns[format];
        if (pattern) {
            format = pattern;
        }

        format = format.split("");
        length = format.length;

        for (; idx < length; idx++) {
            ch = format[idx];

            if (literal) {
                if (ch === "'") {
                    literal = false;
                } else {
                    checkLiteral();
                }
            } else {
                if (ch === "d") {
                    count = lookAhead("d");
                    if (!calendar._lowerDays) {
                        calendar._lowerDays = lowerLocalInfo(calendar.days);
                    }

                    day = count < 3 ? getNumber(2) : getIndexByName(calendar._lowerDays[count == 3 ? "namesAbbr" : "names"], true);

                    if (day === null || outOfRange(day, 1, 31)) {
                        return null;
                    }
                } else if (ch === "M") {
                    count = lookAhead("M");
                    if (!calendar._lowerMonths) {
                        calendar._lowerMonths = lowerLocalInfo(calendar.months);
                    }
                    month = count < 3 ? getNumber(2) : getIndexByName(calendar._lowerMonths[count == 3 ? 'namesAbbr' : 'names'], true);

                    if (month === null || outOfRange(month, 1, 12)) {
                        return null;
                    }
                    month -= 1; //because month is zero based
                } else if (ch === "y") {
                    count = lookAhead("y");
                    year = getNumber(count);

                    if (year === null) {
                        return null;
                    }

                    if (count == 2) {
                        if (typeof twoDigitYearMax === "string") {
                            twoDigitYearMax = defaultYear + parseInt(twoDigitYearMax, 10);
                        }

                        year = (defaultYear - defaultYear % 100) + year;
                        if (year > twoDigitYearMax) {
                            year -= 100;
                        }
                    }
                } else if (ch === "h" ) {
                    lookAhead("h");
                    hours = getNumber(2);
                    if (hours == 12) {
                        hours = 0;
                    }
                    if (hours === null || outOfRange(hours, 0, 11)) {
                        return null;
                    }
                } else if (ch === "H") {
                    lookAhead("H");
                    hours = getNumber(2);
                    if (hours === null || outOfRange(hours, 0, 23)) {
                        return null;
                    }
                } else if (ch === "m") {
                    lookAhead("m");
                    minutes = getNumber(2);
                    if (minutes === null || outOfRange(minutes, 0, 59)) {
                        return null;
                    }
                } else if (ch === "s") {
                    lookAhead("s");
                    seconds = getNumber(2);
                    if (seconds === null || outOfRange(seconds, 0, 59)) {
                        return null;
                    }
                } else if (ch === "f") {
                    count = lookAhead("f");
                    milliseconds = getNumber(count);

                    if (milliseconds !== null && count > 3) {
                        milliseconds = parseInt(milliseconds.toString().substring(0, 3), 10);
                    }

                    if (milliseconds === null || outOfRange(milliseconds, 0, 999)) {
                        return null;
                    }

                } else if (ch === "t") {
                    count = lookAhead("t");
                    amDesignators = calendar.AM;
                    pmDesignators = calendar.PM;

                    if (count === 1) {
                        amDesignators = mapDesignators(amDesignators);
                        pmDesignators = mapDesignators(pmDesignators);
                    }

                    pmHour = getIndexByName(pmDesignators);
                    if (!pmHour && !getIndexByName(amDesignators)) {
                        return null;
                    }
                }
                else if (ch === "z") {
                    UTC = true;
                    count = lookAhead("z");

                    if (value.substr(valueIdx, 1) === "Z") {
                        if (!ISO8601) {
                            return null;
                        }

                        checkLiteral();
                        continue;
                    }

                    matches = value.substr(valueIdx, 6)
                                   .match(count > 2 ? longTimeZoneRegExp : shortTimeZoneRegExp);

                    if (!matches) {
                        return null;
                    }

                    matches = matches[0];
                    valueIdx = matches.length;
                    matches = matches.split(":");

                    hoursOffset = parseInt(matches[0], 10);
                    if (outOfRange(hoursOffset, -12, 13)) {
                        return null;
                    }

                    if (count > 2) {
                        minutesOffset = parseInt(matches[1], 10);
                        if (isNaN(minutesOffset) || outOfRange(minutesOffset, 0, 59)) {
                            return null;
                        }
                    }
                } else if (ch === "T") {
                    ISO8601 = checkLiteral();
                } else if (ch === "'") {
                    literal = true;
                    checkLiteral();
                } else if (!checkLiteral()) {
                    return null;
                }
            }
        }

        if (year === null) {
            year = defaultYear;
        }

        if (pmHour && hours < 12) {
            hours += 12;
        }

        if (day === null) {
            day = 1;
        }

        if (UTC) {
            if (hoursOffset) {
                hours += -hoursOffset;
            }

            if (minutesOffset) {
                minutes += -minutesOffset;
            }

            value = new Date(Date.UTC(year, month, day, hours, minutes, seconds, milliseconds));
        } else {
            value = new Date(year, month, day, hours, minutes, seconds, milliseconds);
            adjustDST(value, hours);
        }

        if (year < 100) {
            value.setFullYear(year);
        }

        if (value.getDate() !== day && UTC === undefined) {
            return null;
        }

        return value;
    }

    kendo.parseDate = function(value, formats, culture) {
        if (objectToString.call(value) === "[object Date]") {
            return value;
        }

        var idx = 0,
            date = null,
            length, patterns;

        if (value && value.indexOf("/D") === 0) {
            date = dateRegExp.exec(value);
            if (date) {
                return new Date(parseInt(date[1], 10));
            }
        }

        culture = kendo.getCulture(culture);

        if (!formats) {
            formats = [];
            patterns = culture.calendar.patterns;
            length = formatsSequence.length;

            for (; idx < length; idx++) {
                formats[idx] = patterns[formatsSequence[idx]];
            }

            idx = 0;

            formats.push(
                "yyyy/MM/dd HH:mm:ss",
                "yyyy/MM/dd HH:mm",
                "yyyy/MM/dd",
                "ddd MMM dd yyyy HH:mm:ss",
                "yyyy-MM-ddTHH:mm:ss.fffffffzzz",
                "yyyy-MM-ddTHH:mm:ss.fffzzz",
                "yyyy-MM-ddTHH:mm:sszzz",
                "yyyy-MM-ddTHH:mmzzz",
                "yyyy-MM-ddTHH:mmzz",
                "yyyy-MM-ddTHH:mm:ss",
                "yyyy-MM-ddTHH:mm",
                "yyyy-MM-dd HH:mm:ss",
                "yyyy-MM-dd HH:mm",
                "yyyy-MM-dd"
            );
        }

        formats = isArray(formats) ? formats: [formats];
        length = formats.length;

        for (; idx < length; idx++) {
            date = parseExact(value, formats[idx], culture);
            if (date) {
                return date;
            }
        }

        return date;
    };

    kendo.parseInt = function(value, culture) {
        var result = kendo.parseFloat(value, culture);
        if (result) {
            result = result | 0;
        }
        return result;
    };

    kendo.parseFloat = function(value, culture, format) {
        if (!value && value !== 0) {
           return null;
        }

        if (typeof value === NUMBER) {
           return value;
        }

        value = value.toString();
        culture = kendo.getCulture(culture);

        var number = culture.numberFormat,
            percent = number.percent,
            currency = number.currency,
            symbol = currency.symbol,
            percentSymbol = percent.symbol,
            negative = value.indexOf("-"),
            parts, isPercent;

        //handle exponential number
        if (exponentRegExp.test(value)) {
            value = parseFloat(value);
            if (isNaN(value)) {
                value = null;
            }
            return value;
        }

        if (negative > 0) {
            return null;
        } else {
            negative = negative > -1;
        }

        if (value.indexOf(symbol) > -1 || (format && format.toLowerCase().indexOf("c") > -1)) {
            number = currency;
            parts = number.pattern[0].replace("$", symbol).split("n");
            if (value.indexOf(parts[0]) > -1 && value.indexOf(parts[1]) > -1) {
                value = value.replace(parts[0], "").replace(parts[1], "");
                negative = true;
            }
        } else if (value.indexOf(percentSymbol) > -1) {
            isPercent = true;
            number = percent;
            symbol = percentSymbol;
        }

        value = value.replace("-", "")
                     .replace(symbol, "")
                     .replace(nonBreakingSpaceRegExp, " ")
                     .split(number[","].replace(nonBreakingSpaceRegExp, " ")).join("")
                     .replace(number["."], ".");

        value = parseFloat(value);

        if (isNaN(value)) {
            value = null;
        } else if (negative) {
            value *= -1;
        }

        if (value && isPercent) {
            value /= 100;
        }

        return value;
    };

    if (globalize) {
        kendo.parseDate = function (value, format, culture) {
            if (objectToString.call(value) === "[object Date]") {
                return value;
            }

            return globalize.parseDate(value, format, culture);
        };

        kendo.parseFloat = function (value, culture) {
            if (typeof value === NUMBER) {
                return value;
            }

            if (value === undefined || value === null) {
               return null;
            }

            value = globalize.parseFloat(value, culture);

            return isNaN(value) ? null : value;
        };
    }
})();

    function wrap(element) {
        var browser = support.browser,
            percentage,
            isRtl = element.css("direction") == "rtl";

        if (!element.parent().hasClass("k-animation-container")) {
            var shadow = element.css(kendo.support.transitions.css + "box-shadow") || element.css("box-shadow"),
                radius = shadow ? shadow.match(boxShadowRegExp) || [ 0, 0, 0, 0, 0 ] : [ 0, 0, 0, 0, 0 ],
                blur = math.max((+radius[3]), +(radius[4] || 0)),
                left = (-radius[1]) + blur,
                right = (+radius[1]) + blur,
                bottom = (+radius[2]) + blur,
                width = element[0].style.width,
                height = element[0].style.height,
                percentWidth = percentRegExp.test(width),
                percentHeight = percentRegExp.test(height);

            if (browser.opera) { // Box shadow can't be retrieved in Opera
                left = right = bottom = 5;
            }

            percentage = percentWidth || percentHeight;

            if (!percentWidth) { width = element.outerWidth(); }
            if (!percentHeight) { height = element.outerHeight(); }

            element.wrap(
                         $("<div/>")
                         .addClass("k-animation-container")
                         .css({
                             width: width,
                             height: height,
                             marginLeft: left * (isRtl ? 1 : -1),
                             paddingLeft: left,
                             paddingRight: right,
                             paddingBottom: bottom
                         }));

            if (percentage) {
                element.css({
                    width: "100%",
                    height: "100%",
                    boxSizing: "border-box",
                    mozBoxSizing: "border-box",
                    webkitBoxSizing: "border-box"
                });
            }
        } else {
            var wrapper = element.parent(".k-animation-container"),
                wrapperStyle = wrapper[0].style;

            if (wrapper.is(":hidden")) {
                wrapper.show();
            }

            percentage = percentRegExp.test(wrapperStyle.width) || percentRegExp.test(wrapperStyle.height);

            if (!percentage) {
                wrapper.css({
                    width: element.outerWidth(),
                    height: element.outerHeight()
                });
            }
        }

        if (browser.msie && math.floor(browser.version) <= 7) {
            element.css({ zoom: 1 });
            element.children(".k-menu").width(element.width());
        }

        return element.parent();
    }

    function deepExtend(destination) {
        var i = 1,
            length = arguments.length;

        for (i = 1; i < length; i++) {
            deepExtendOne(destination, arguments[i]);
        }

        return destination;
    }

    function deepExtendOne(destination, source) {
        var ObservableArray = kendo.data.ObservableArray,
            DataSource = kendo.data.DataSource,
            property,
            propValue,
            propType,
            destProp;

        for (property in source) {
            propValue = source[property];
            propType = typeof propValue;
            if (propType === OBJECT && propValue !== null && propValue.constructor !== Array &&
                propValue.constructor !== ObservableArray && propValue.constructor !== DataSource) {
                if (propValue instanceof Date) {
                    destination[property] = new Date(propValue.getTime());
                } else {
                    destProp = destination[property];
                    if (typeof (destProp) === OBJECT) {
                        destination[property] = destProp || {};
                    } else {
                        destination[property] = {};
                    }
                    deepExtendOne(destination[property], propValue);
                }
            } else if (propType !== UNDEFINED) {
                destination[property] = propValue;
            }
        }

        return destination;
    }

    function testRx(agent, rxs, dflt) {
        for (var rx in rxs) {
            if (rxs.hasOwnProperty(rx) && rxs[rx].test(agent)) {
                return rx;
            }
        }
        return dflt !== undefined ? dflt : agent;
    }

    function getComputedStyles(element, properties) {
        var styles = {}, computedStyle;

        if (document.defaultView && document.defaultView.getComputedStyle) {
            computedStyle = document.defaultView.getComputedStyle(element, "");

            if (properties) {
                $.each(properties, function(idx, value) {
                    styles[value] = computedStyle.getPropertyValue(value);
                });
            }
        } else {
            computedStyle = element.currentStyle;

            if (properties) {
                $.each(properties, function(idx, value) {
                    styles[value] = computedStyle[value.replace(/\-(\w)/g, function (strMatch, g1) { return g1.toUpperCase(); })];
                });
            }
        }

        if (!kendo.size(styles)) {
            styles = computedStyle;
        }

        return styles;
    }

    (function() {
        support.scrollbar = function() {
            var div = document.createElement("div"),
                result;

            div.style.cssText = "overflow:scroll;overflow-x:hidden;zoom:1;clear:both";
            div.innerHTML = "&nbsp;";
            document.body.appendChild(div);

            result = div.offsetWidth - div.scrollWidth;

            document.body.removeChild(div);
            return result;
        };

        support.isRtl = function(element) {
            return $(element).closest(".k-rtl").length > 0;
        };

        var table = document.createElement("table");

        // Internet Explorer does not support setting the innerHTML of TBODY and TABLE elements
        try {
            table.innerHTML = "<tr><td></td></tr>";

            support.tbodyInnerHtml = true;
        } catch (e) {
            support.tbodyInnerHtml = false;
        }

        support.touch = "ontouchstart" in window;
        support.pointers = navigator.msPointerEnabled;

        var transitions = support.transitions = false,
            transforms = support.transforms = false,
            elementProto = "HTMLElement" in window ? HTMLElement.prototype : [];

        support.hasHW3D = ("WebKitCSSMatrix" in window && "m11" in new window.WebKitCSSMatrix()) || "MozPerspective" in document.documentElement.style || "msPerspective" in document.documentElement.style;

        each([ "Moz", "webkit", "O", "ms" ], function () {
            var prefix = this.toString(),
                hasTransitions = typeof table.style[prefix + "Transition"] === STRING;

            if (hasTransitions || typeof table.style[prefix + "Transform"] === STRING) {
                var lowPrefix = prefix.toLowerCase();

                transforms = {
                    css: (lowPrefix != "ms") ? "-" + lowPrefix + "-" : "",
                    prefix: prefix,
                    event: (lowPrefix === "o" || lowPrefix === "webkit") ? lowPrefix : ""
                };

                if (hasTransitions) {
                    transitions = transforms;
                    transitions.event = transitions.event ? transitions.event + "TransitionEnd" : "transitionend";
                }

                return false;
            }
        });

        support.transforms = transforms;
        support.transitions = transitions;

        support.devicePixelRatio = window.devicePixelRatio === undefined ? 1 : window.devicePixelRatio;

        try {
            support.screenWidth = window.outerWidth || window.screen ? window.screen.availWidth : window.innerWidth;
            support.screenHeight = window.outerHeight || window.screen ? window.screen.availHeight : window.innerHeight;

            support.zoomLevel = function() {
                return support.touch ? (document.documentElement.clientWidth / window.innerWidth) :
                       support.pointers ? ((top || window).outerWidth / (top || window).innerWidth) : 1;
            };
        } catch(e) {
            //window.outerWidth throws error when in IE showModalDialog.
            support.screenWidth = window.screen.availWidth;
            support.screenHeight = window.screen.availHeight;

            support.zoomLevel = function() {
                return 1;
            };
        }

        support.detectOS = function (ua) {
            var os = false, minorVersion, match = [],
                notAndroidPhone = !/mobile safari/i.test(ua),
                agentRxs = {
                    fire: /(Silk)\/(\d+)\.(\d+(\.\d+)?)/,
                    android: /(Android|Android.*(?:Opera|Firefox).*?\/)\s*(\d+)\.(\d+(\.\d+)?)/,
                    iphone: /(iPhone|iPod).*OS\s+(\d+)[\._]([\d\._]+)/,
                    ipad: /(iPad).*OS\s+(\d+)[\._]([\d_]+)/,
                    meego: /(MeeGo).+NokiaBrowser\/(\d+)\.([\d\._]+)/,
                    webos: /(webOS)\/(\d+)\.(\d+(\.\d+)?)/,
                    blackberry: /(BlackBerry|BB10).*?Version\/(\d+)\.(\d+(\.\d+)?)/,
                    playbook: /(PlayBook).*?Tablet\s*OS\s*(\d+)\.(\d+(\.\d+)?)/,
                    wp: /(Windows Phone(?: OS)?)\s(\d+)\.(\d+(\.\d+)?)/,
                    windows: /(MSIE)\s+(\d+)\.(\d+(\.\d+)?)/,
                    ffos: /(Mobile).*rv:(\d+)\.(\d+(\.\d+)?).*Firefox/
                },
                osRxs = {
                    ios: /^i(phone|pad|pod)$/i,
                    android: /^android|fire$/i,
                    blackberry: /^blackberry|playbook/i,
                    windows: /windows/,
                    wp: /wp/,
                    meego: /meego|ffos/
                },
                formFactorRxs = {
                    tablet: /playbook|ipad|fire/i
                },
                browserRxs = {
                    omini: /Opera\sMini/i,
                    omobile: /Opera\sMobi/i,
                    firefox: /Firefox|Fennec/i,
                    mobilesafari: /version\/.*safari/i,
                    chrome: /chrome/i,
                    webkit: /webkit/i,
                    ie: /MSIE|Windows\sPhone/i
                };

            for (var agent in agentRxs) {
                if (agentRxs.hasOwnProperty(agent)) {
                    match = ua.match(agentRxs[agent]);
                    if (match) {
                        if (agent == "windows" && "plugins" in navigator) { return false; } // Break if not Metro/Mobile Windows

                        os = {};
                        os.device = agent;
                        os.tablet = testRx(agent, formFactorRxs, false);
                        os.browser = testRx(ua, browserRxs, "default");
                        os.name = testRx(agent, osRxs);
                        os[os.name] = true;
                        os.majorVersion = match[2];
                        os.minorVersion = match[3].replace("_", ".");
                        minorVersion = os.minorVersion.replace(".", "").substr(0, 2);
                        os.flatVersion = os.majorVersion + minorVersion + (new Array(3 - (minorVersion.length < 3 ? minorVersion.length : 2)).join("0"));
                        os.appMode = window.navigator.standalone || (/file|local|wmapp/).test(window.location.protocol) || typeof window.PhoneGap !== UNDEFINED || typeof window.cordova !== UNDEFINED; // Use file protocol to detect appModes.

                        if (os.android && (support.devicePixelRatio < 1.5 && os.flatVersion < 400 || notAndroidPhone) && (support.screenWidth > 800 || support.screenHeight > 800)) {
                            os.tablet = agent;
                        }

                        break;
                    }
                }
            }
            return os;
        };

        var mobileOS = support.mobileOS = support.detectOS(navigator.userAgent);

        support.wpDevicePixelRatio = mobileOS.wp ? screen.width / 320 : 0;
        support.kineticScrollNeeded = mobileOS && (support.touch || support.pointers);

        support.hasNativeScrolling = false;

        if ((mobileOS.ios && mobileOS.majorVersion > 4) || (mobileOS.android && mobileOS.majorVersion > 2) || mobileOS.wp) {
            support.hasNativeScrolling = mobileOS;
        }

        support.mouseAndTouchPresent = support.touch && !(support.mobileOS.ios || support.mobileOS.android);

        function detectBrowser(ua) {
            var browser = false, match = [],
                browserRxs = {
                    webkit: /(chrome)[ \/]([\w.]+)/i,
                    safari: /(webkit)[ \/]([\w.]+)/i,
                    opera: /(opera)(?:.*version|)[ \/]([\w.]+)/i,
                    msie: /(msie) ([\w.]+)/i,
                    mozilla: /(mozilla)(?:.*? rv:([\w.]+)|)/i
                };

            for (var agent in browserRxs) {
                if (browserRxs.hasOwnProperty(agent)) {
                    match = ua.match(browserRxs[agent]);
                    if (match) {
                        browser = {};
                        browser[agent] = true;
                        browser[match[1].toLowerCase()] = true;
                        browser.version = parseInt(document.documentMode || match[2], 10);

                        break;
                    }
                }
            }

            return browser;
        }

        support.browser = detectBrowser(navigator.userAgent);

        support.cssBorderSpacing = typeof document.documentElement.style.borderSpacing != "undefined" && !(support.browser.msie && support.browser.version < 8);

        (function(browser) {
            // add browser-specific CSS class
            var cssClass,
                majorVersion = parseInt(browser.version, 10);

            if (browser.msie) {
                cssClass = "ie";
            } else if (browser.mozilla) {
                cssClass = "ff";
            } else if (browser.safari) {
                cssClass = "safari";
            } else if (browser.webkit) {
                cssClass = "webkit";
            } else if (browser.opera) {
                cssClass = "opera";
            }

            if (cssClass) {
                $(document.documentElement).addClass("k-" + cssClass + " k-" + cssClass + majorVersion);
            }
        })(support.browser);

        support.eventCapture = document.documentElement.addEventListener;

        support.placeholder = "placeholder" in document.createElement("input");
        support.stableSort = (function() {
            var sorted = [0,1,2,3,4,5,6,7,8,9,10,11,12].sort(function() { return 0; } );
            return sorted[0] === 0 && sorted[1] === 1 && sorted[2] === 2 && sorted[3] === 3 && sorted[4] === 4 &&
                sorted[5] === 5 && sorted[6] === 6 && sorted[7] === 7 && sorted[8] === 8 &&
                sorted[9] === 9 && sorted[10] === 10 && sorted[11] === 11 && sorted[12] === 12;
        })();

        support.matchesSelector = elementProto.webkitMatchesSelector || elementProto.mozMatchesSelector ||
                                  elementProto.msMatchesSelector || elementProto.oMatchesSelector || elementProto.matchesSelector ||
          function( selector ) {
              var nodeList = document.querySelectorAll ? ( this.parentNode || document ).querySelectorAll( selector ) || [] : $(selector),
                  i = nodeList.length;

              while (i--) {
                  if (nodeList[i] == this) {
                      return true;
                  }
              }

              return false;
          };

        support.pushState = window.history && window.history.pushState;

        var documentMode = document.documentMode;

        support.hashChange = ("onhashchange" in window) && !(support.browser.msie && (!documentMode || documentMode <= 8)); // old IE detection
    })();


    function size(obj) {
        var result = 0, key;
        for (key in obj) {
            if (obj.hasOwnProperty(key) && key != "toJSON") { // Ignore fake IE7 toJSON.
                result++;
            }
        }

        return result;
    }

    function getOffset(element, type, positioned) {
        if (!type) {
            type = "offset";
        }

        var result = element[type](),
            mobileOS = support.mobileOS;

        if (support.touch && mobileOS.ios && mobileOS.flatVersion < 410) { // Extra processing only in broken iOS'
            var offset = type == "offset" ? result : element.offset(),
                position = (result.left == offset.left && result.top == offset.top);

            if (position) {
                return {
                    top: result.top - window.scrollY,
                    left: result.left - window.scrollX
                };
            }
        }

        if (kendo.support.pointers && !positioned) { // IE10 touch zoom is living in a separate viewport.
            result.top -= (window.pageYOffset - document.documentElement.scrollTop);
            result.left -= (window.pageXOffset - document.documentElement.scrollLeft);
        }

        return result;
    }

    var directions = {
        left: { reverse: "right" },
        right: { reverse: "left" },
        down: { reverse: "up" },
        up: { reverse: "down" },
        top: { reverse: "bottom" },
        bottom: { reverse: "top" },
        "in": { reverse: "out" },
        out: { reverse: "in" }
    };

    function parseEffects(input) {
        var effects = {};

        each((typeof input === "string" ? input.split(" ") : input), function(idx) {
            effects[idx] = this;
        });

        return effects;
    }

    function fx(element) {
        return new kendo.effects.Element(element);
    }

    var effects = {};

    $.extend(effects, {
        Element: function(element) {
            this.element = $(element);
        },

        promise: function (element, options) {
            if (!element.is(":visible")) {
                element.css({ display: element.data("olddisplay") || "block" }).css("display");
            }

            if (options.hide) {
                element.data("olddisplay", element.css("display")).hide();
            }

            if (options.init) {
                options.init();
            }

            if (options.completeCallback) {
                options.completeCallback(element); // call the external complete callback with the element
            }

            element.dequeue();
        },

        transitionPromise: function(element, destination, options) {
            var container = kendo.wrap(element);
            container.append(destination);

            element.hide();
            destination.show();

            if (options.completeCallback) {
                options.completeCallback(element); // call the external complete callback with the element
            }

            return element;
        }
    });

    function prepareAnimationOptions(options, duration, reverse, complete) {
        if (typeof options === STRING) {
            // options is the list of effect names separated by space e.g. animate(element, "fadeIn slideDown")

            // only callback is provided e.g. animate(element, options, function() {});
            if (isFunction(duration)) {
                complete = duration;
                duration = 400;
                reverse = false;
            }

            if (isFunction(reverse)) {
                complete = reverse;
                reverse = false;
            }

            if (typeof duration === BOOLEAN){
                reverse = duration;
                duration = 400;
            }

            options = {
                effects: options,
                duration: duration,
                reverse: reverse,
                complete: complete
            };
        }

        return extend({
            //default options
            effects: {},
            duration: 400, //jQuery default duration
            reverse: false,
            init: noop,
            teardown: noop,
            hide: false
        }, options, { completeCallback: options.complete, complete: noop }); // Move external complete callback, so deferred.resolve can be always executed.

    }

    function animate(element, options, duration, reverse, complete) {
        var idx = 0,
            length = element.length,
            instance;

        for (; idx < length; idx ++) {
            instance = $(element[idx]);
            instance.queue(function() {
                effects.promise(instance, prepareAnimationOptions(options, duration, reverse, complete));
            });
        }

        return element;
    }

    function animateTo(element, destination, options, duration, reverse, complete) {
        return effects.transitionPromise(element, destination, prepareAnimationOptions(options, duration, reverse, complete));
    }

    function toggleClass(element, classes, options, add) {
        if (classes) {
            classes = classes.split(" ");

            each(classes, function(idx, value) {
                element.toggleClass(value, add);
            });
        }

        return element;
    }

    if (!("kendoAnimate" in $.fn)) {
        extend($.fn, {
            kendoStop: function(clearQueue, gotoEnd) {
                return this.stop(clearQueue, gotoEnd);
            },

            kendoAnimate: function(options, duration, reverse, complete) {
                return animate(this, options, duration, reverse, complete);
            },

            kendoAnimateTo: function(destination, options, duration, reverse, complete) {
                return animateTo(this, destination, options, duration, reverse, complete);
            },

            kendoAddClass: function(classes, options){
                return kendo.toggleClass(this, classes, options, true);
            },
            kendoRemoveClass: function(classes, options){
                return kendo.toggleClass(this, classes, options, false);
            },
            kendoToggleClass: function(classes, options, toggle){
                return kendo.toggleClass(this, classes, options, toggle);
            }
        });
    }

    var ampRegExp = /&/g,
        ltRegExp = /</g,
        gtRegExp = />/g;
    function htmlEncode(value) {
        return ("" + value).replace(ampRegExp, "&amp;").replace(ltRegExp, "&lt;").replace(gtRegExp, "&gt;");
    }

    var eventTarget = function (e) {
        return e.target;
    };

    if (support.touch) {

        eventTarget = function(e) {
            var touches = "originalEvent" in e ? e.originalEvent.changedTouches : "changedTouches" in e ? e.changedTouches : null;

            return touches ? document.elementFromPoint(touches[0].clientX, touches[0].clientY) : e.target;
        };

        each(["swipe", "swipeLeft", "swipeRight", "swipeUp", "swipeDown", "doubleTap", "tap"], function(m, value) {
            $.fn[value] = function(callback) {
                return this.bind(value, callback);
            };
        });
    }

    if (support.touch) {
        if (!support.mobileOS) {
            support.mousedown = "mousedown touchstart";
            support.mouseup = "mouseup touchend";
            support.mousemove = "mousemove touchmove";
            support.mousecancel = "mouseleave touchcancel";
            support.click = "click";
            support.resize = "resize";
        } else {
            support.mousedown = "touchstart";
            support.mouseup = "touchend";
            support.mousemove = "touchmove";
            support.mousecancel = "touchcancel";
            support.click = "touchend";
            support.resize = "orientationchange";
        }
    } else if (support.pointers) {
        support.mousemove = "MSPointerMove";
        support.mousedown = "MSPointerDown";
        support.mouseup = "MSPointerUp";
        support.mousecancel = "MSPointerCancel";
        support.click = "MSPointerUp";
        support.resize = "orientationchange resize";
    } else {
        support.mousemove = "mousemove";
        support.mousedown = "mousedown";
        support.mouseup = "mouseup";
        support.mousecancel = "mouseleave";
        support.click = "click";
        support.resize = "resize";
    }

    var wrapExpression = function(members, paramName) {
        var result = paramName || "d",
            index,
            idx,
            length,
            member,
            count = 1;

        for (idx = 0, length = members.length; idx < length; idx++) {
            member = members[idx];
            if (member !== "") {
                index = member.indexOf("[");

                if (index !== 0) {
                    if (index == -1) {
                        member = "." + member;
                    } else {
                        count++;
                        member = "." + member.substring(0, index) + " || {})" + member.substring(index);
                    }
                }

                count++;
                result += member + ((idx < length - 1) ? " || {})" : ")");
            }
        }
        return new Array(count).join("(") + result;
    },
    localUrlRe = /^([a-z]+:)?\/\//i;

    extend(kendo, {
        ui: kendo.ui || {},
        fx: kendo.fx || fx,
        effects: kendo.effects || effects,
        mobile: kendo.mobile || {},
        data: kendo.data || {},
        dataviz: kendo.dataviz || {ui: { roles: {}}},
        keys: {
            INSERT: 45,
            DELETE: 46,
            BACKSPACE: 8,
            TAB: 9,
            ENTER: 13,
            ESC: 27,
            LEFT: 37,
            UP: 38,
            RIGHT: 39,
            DOWN: 40,
            END: 35,
            HOME: 36,
            SPACEBAR: 32,
            PAGEUP: 33,
            PAGEDOWN: 34,
            F2: 113,
            F10: 121,
            F12: 123
        },
        support: kendo.support || support,
        animate: kendo.animate || animate,
        ns: "",
        attr: function(value) {
            return "data-" + kendo.ns + value;
        },
        wrap: wrap,
        deepExtend: deepExtend,
        getComputedStyles: getComputedStyles,
        size: size,
        getOffset: kendo.getOffset || getOffset,
        parseEffects: kendo.parseEffects || parseEffects,
        toggleClass: kendo.toggleClass || toggleClass,
        directions: kendo.directions || directions,
        Observable: Observable,
        Class: Class,
        Template: Template,
        template: proxy(Template.compile, Template),
        render: proxy(Template.render, Template),
        stringify: proxy(JSON.stringify, JSON),
        eventTarget: eventTarget,
        htmlEncode: htmlEncode,
        isLocalUrl: function(url) {
            return url && !localUrlRe.test(url);
        },

        expr: function(expression, safe, paramName) {
            expression = expression || "";

            if (typeof safe == STRING) {
                paramName = safe;
                safe = false;
            }

            paramName = paramName || "d";

            if (expression && expression.charAt(0) !== "[") {
                expression = "." + expression;
            }

            if (safe) {
                expression = wrapExpression(expression.split("."), paramName);
            } else {
                expression = paramName + expression;
            }

            return expression;
        },

        getter: function(expression, safe) {
            return getterCache[expression] = getterCache[expression] || new Function("d", "return " + kendo.expr(expression, safe));
        },

        setter: function(expression) {
            return setterCache[expression] = setterCache[expression] || new Function("d,value", kendo.expr(expression) + "=value");
        },

        accessor: function(expression) {
            return {
                get: kendo.getter(expression),
                set: kendo.setter(expression)
            };
        },

        guid: function() {
            var id = "", i, random;

            for (i = 0; i < 32; i++) {
                random = math.random() * 16 | 0;

                if (i == 8 || i == 12 || i == 16 || i == 20) {
                    id += "-";
                }
                id += (i == 12 ? 4 : (i == 16 ? (random & 3 | 8) : random)).toString(16);
            }

            return id;
        },

        roleSelector: function(role) {
            return role.replace(/(\S+)/g, "[" + kendo.attr("role") + "=$1],").slice(0, -1);
        },

        triggeredByInput: function(e) {
            return (/^(label|input|textarea|select)$/i).test(e.target.tagName);
        },

        logToConsole: function(message) {
            var console = window.console;

            if (typeof(console) != "undefined" && console.log) {
                console.log(message);
            }
        }
    });

    var Widget = Observable.extend( {
        init: function(element, options) {
            var that = this;

            that.element = kendo.jQuery(element).handler(that);

            Observable.fn.init.call(that);

            options = that.options = extend(true, {}, that.options, options);

            if (!that.element.attr(kendo.attr("role"))) {
                that.element.attr(kendo.attr("role"), (options.name || "").toLowerCase());
            }

            that.element.data("kendo" + options.prefix + options.name, that);

            that.bind(that.events, options);
        },

        events: [],

        options: {
            prefix: ""
        },

        _tabindex: function(target) {
            target = target || this.wrapper;

            var element = this.element,
                TABINDEX = "tabindex",
                tabindex = target.attr(TABINDEX) || element.attr(TABINDEX);

            element.removeAttr(TABINDEX);

            target.attr(TABINDEX, !isNaN(tabindex) ? tabindex : 0);
        },

        setOptions: function(options) {
            var that = this,
                idx = 0,
                length = that.events.length,
                e;

            for (; idx < length; idx ++) {
                e = that.events[idx];
                if (that.options[e] && options[e]) {
                    that.unbind(e, that.options[e]);
                }
            }

            $.extend(that.options, options);
            that.bind(that.events, options);
        },

        destroy: function() {
            var that = this;

            that.element.removeData("kendo" + that.options.prefix + that.options.name);
            that.element.removeData("handler");

            that.unbind();
        }
    });

    kendo.notify = noop;

    var templateRegExp = /template$/i,
        jsonRegExp = /^\s*(?:\{(?:.|\r\n|\n)*\}|\[(?:.|\r\n|\n)*\])\s*$/,
        jsonFormatRegExp = /^\{(\d+)(:[^\}]+)?\}/,
        dashRegExp = /([A-Z])/g;

    function parseOption(element, option) {
        var value;

        if (option.indexOf("data") === 0) {
            option = option.substring(4);
            option = option.charAt(0).toLowerCase() + option.substring(1);
        }

        option = option.replace(dashRegExp, "-$1");
        value = element.getAttribute("data-" + kendo.ns + option);

        if (value === null) {
            value = undefined;
        } else if (value === "null") {
            value = null;
        } else if (value === "true") {
            value = true;
        } else if (value === "false") {
            value = false;
        } else if (numberRegExp.test(value)) {
            value = parseFloat(value);
        } else if (jsonRegExp.test(value) && !jsonFormatRegExp.test(value)) {
            value = evil("(" + value + ")");
        }

        return value;
    }

    function parseOptions(element, options) {
        var result = {},
            option,
            value;

        for (option in options) {
            value = parseOption(element, option);

            if (value !== undefined) {

                if (templateRegExp.test(option)) {
                    value = kendo.template($("#" + value).html());
                }

                result[option] = value;
            }
        }

        return result;
    }

    kendo.initWidget = function(element, options, roles) {
        var result,
            option,
            widget,
            idx,
            length,
            role,
            value,
            dataSource;

        // Preserve backwards compatibility with (element, options, namespace) signature, where namespace was kendo.ui
        if (!roles) {
            roles = kendo.ui.roles;
        } else if (roles.roles) {
            roles = roles.roles;
        }

        element = element.nodeType ? element : element[0];

        role = element.getAttribute("data-" + kendo.ns + "role");

        if (!role) {
            return;
        }

        if (role.indexOf(".") === -1) {
            widget = roles[role];
        } else { // full namespace path - like kendo.ui.Widget
            widget = kendo.getter(role)(window);
        }

        if (!widget) {
            return;
        }

        dataSource = parseOption(element, "dataSource");

        options = $.extend({}, parseOptions(element, widget.fn.options), options);

        if (dataSource) {
            if (typeof dataSource === STRING) {
                options.dataSource = kendo.getter(dataSource)(window);
            } else {
                options.dataSource = dataSource;
            }
        }

        for (idx = 0, length = widget.fn.events.length; idx < length; idx++) {
            option = widget.fn.events[idx];

            value = parseOption(element, option);

            if (value !== undefined) {
                options[option] = kendo.getter(value)(window);
            }
        }

        result = $(element).data("kendo" + widget.fn.options.prefix + widget.fn.options.name);

        if (!result) {
            result = new widget(element, options);
        } else {
            result.setOptions(options);
        }

        return result;
    };

    kendo.rolesFromNamespaces = function(namespaces) {
        var roles = [],
            idx,
            length;

        if (!namespaces[0]) {
            namespaces = [kendo.ui, kendo.dataviz.ui];
        }

        for (idx = 0, length = namespaces.length; idx < length; idx ++) {
            roles[idx] = namespaces[idx].roles;
        }

        return extend.apply(null, [{}].concat(roles.reverse()));
    };

    kendo.init = function(element) {
        var roles = kendo.rolesFromNamespaces(slice.call(arguments, 1));

        $(element).find("[data-" + kendo.ns + "role]").andSelf().each(function(){
            kendo.initWidget(this, {}, roles);
        });
    };

    kendo.destroy = function(element) {
        $(element).find("[data-" + kendo.ns + "role]").andSelf().each(function(){
            var element = $(this),
                widget = kendo.widgetInstance(element, kendo.ui) ||
                         kendo.widgetInstance(element, kendo.mobile.ui) ||
                         kendo.widgetInstance(element, kendo.dataviz.ui);

            if (widget) {
                widget.destroy();
            }
        });
    };

    kendo.parseOptions = parseOptions;

    extend(kendo.ui, {
        Widget: Widget,
        roles: {},
        progress: function(container, toggle) {
            var mask = container.find(".k-loading-mask"),
                support = kendo.support,
                browser = support.browser,
                isRtl, leftRight, webkitCorrection, containerScrollLeft;

            if (toggle) {
                if (!mask.length) {
                    isRtl = support.isRtl(container);
                    leftRight = isRtl ? "right" : "left";
                    containerScrollLeft = container.scrollLeft();
                    webkitCorrection = browser.webkit ? (!isRtl ? 0 : container[0].scrollWidth - container.width() - 2 * containerScrollLeft) : 0;

                    mask = $("<div class='k-loading-mask'><span class='k-loading-text'>Loading...</span><div class='k-loading-image'/><div class='k-loading-color'/></div>")
                        .width("100%").height("100%")
                        .css("top", container.scrollTop())
                        .css(leftRight, Math.abs(containerScrollLeft) + webkitCorrection)
                        .prependTo(container);
                }
            } else if (mask) {
                mask.remove();
            }
        },
        plugin: function(widget, register, prefix) {
            var name = widget.fn.options.name,
                getter;

            register = register || kendo.ui;
            prefix = prefix || "";

            register[name] = widget;

            register.roles[name.toLowerCase()] = widget;

            getter = "getKendo" + prefix + name;
            name = "kendo" + prefix + name;

            $.fn[name] = function(options) {
                var value = this,
                    args;

                if (typeof options === STRING) {
                    args = slice.call(arguments, 1);

                    this.each(function(){
                        var widget = $.data(this, name),
                            method,
                            result;

                        if (!widget) {
                            throw new Error(kendo.format("Cannot call method '{0}' of {1} before it is initialized", options, name));
                        }

                        method = widget[options];

                        if (typeof method !== FUNCTION) {
                            throw new Error(kendo.format("Cannot find method '{0}' of {1}", options, name));
                        }

                        result = method.apply(widget, args);

                        if (result !== undefined) {
                            value = result;
                            return false;
                        }
                    });
                } else {
                    this.each(function() {
                        new widget(this, options);
                    });
                }

                return value;
            };

            $.fn[getter] = function() {
                return this.data(name);
            };
        }
    });

    var ContainerNullObject = { bind: function () { return this; } };

    var MobileWidget = Widget.extend({
        init: function(element, options) {
            Widget.fn.init.call(this, element, options);
            this.element.autoApplyNS();
            this.wrapper = this.element;
        },

        destroy: function() {
            Widget.fn.destroy.call(this);
            this.element.kendoDestroy();
        },

        options: {
            prefix: "Mobile"
        },

        events: [],

        view: function() {
            var viewElement = this.element.closest(kendo.roleSelector("view splitview modalview drawer"));
            return kendo.widgetInstance(viewElement, kendo.mobile.ui);
        },

        container: function() {
            var element = this.element.closest(kendo.roleSelector("view layout modalview drawer"));
            return kendo.widgetInstance(element, kendo.mobile.ui) || ContainerNullObject;
        }
    });

    extend(kendo.mobile, {
        init: function(element) {
            kendo.init(element, kendo.mobile.ui, kendo.ui, kendo.dataviz.ui);
        },

        ui: {
            Widget: MobileWidget,
            roles: {},
            plugin: function(widget) {
                kendo.ui.plugin(widget, kendo.mobile.ui, "Mobile");
            }
        }
    });

    kendo.touchScroller = function(elements, options) {
        // return the first touch scroller
        return $(elements).map(function(idx, element) {
            element = $(element);
            if (support.kineticScrollNeeded && kendo.mobile.ui.Scroller && !element.data("kendoMobileScroller")) {
                element.kendoMobileScroller(options);
                return element.data("kendoMobileScroller");
            } else {
                return false;
            }
        })[0];
    };

    kendo.preventDefault = function(e) {
        e.preventDefault();
    };

    kendo.widgetInstance = function(element, suite) {
        var widget = suite.roles[element.data(kendo.ns + "role")];

        if (widget) {
            return element.data("kendo" + widget.fn.options.prefix + widget.fn.options.name);
        }
    };

    kendo.onResize = function(callback) {
        var handler = callback;
        if (support.mobileOS.android) {
            handler = function() { setTimeout(callback, 200); };
        }

        $(window).on(support.resize, handler);
        return handler;
    };

    kendo.unbindResize = function(callback) {
        $(window).off(support.resize, callback);
    };

    kendo.attrValue = function(element, key) {
        return element.data(kendo.ns + key);
    };

    kendo.days = {
        Sunday: 0,
        Monday: 1,
        Tuesday: 2,
        Wednesday: 3,
        Thursday: 4,
        Friday: 5,
        Saturday: 6
    };

    function focusable(element, isTabIndexNotNaN) {
        var nodeName = element.nodeName.toLowerCase();

        return (/input|select|textarea|button|object/.test(nodeName) ?
                !element.disabled :
                "a" === nodeName ?
                element.href || isTabIndexNotNaN :
                isTabIndexNotNaN
               ) &&
            visible(element);
    }

    function visible(element) {
        return !$(element).parents().andSelf().filter(function() {
            return $.css(this,"visibility") === "hidden" || $.expr.filters.hidden(this);
        }).length;
    }

    $.extend($.expr[ ":" ], {
        focusable: function(element) {
            var idx = $.attr(element, "tabindex");
            return focusable(element, !isNaN(idx) && idx > -1);
        }
    });

    var MOUSE_EVENTS = ["mousedown", "mousemove", "mouseenter", "mouseleave", "mouseover", "mouseout", "mouseup", "click"];
    var EXCLUDE_BUST_CLICK_SELECTOR = "label, input, [data-rel=external]";

    var MouseEventNormalizer = {
        setupMouseMute: function() {
            var idx = 0,
                length = MOUSE_EVENTS.length,
                element = document.documentElement;

            if (MouseEventNormalizer.mouseTrap || !support.eventCapture) {
                return;
            }

            MouseEventNormalizer.mouseTrap = true;

            MouseEventNormalizer.bustClick = false;
            MouseEventNormalizer.captureMouse = false;

            var handler = function(e) {
                if (MouseEventNormalizer.captureMouse) {
                    if (e.type === "click") {
                        if (MouseEventNormalizer.bustClick && !$(e.target).is(EXCLUDE_BUST_CLICK_SELECTOR)) {
                            e.preventDefault();
                            e.stopPropagation();
                        }
                    } else {
                        e.stopPropagation();
                    }
                }
            };

            for (; idx < length; idx++) {
                element.addEventListener(MOUSE_EVENTS[idx], handler, true);
            }
        },

        muteMouse: function(e) {
            MouseEventNormalizer.captureMouse = true;
            if (e.data.bustClick) {
                MouseEventNormalizer.bustClick = true;
            }
            clearTimeout(MouseEventNormalizer.mouseTrapTimeoutID);
        },

        unMuteMouse: function() {
            clearTimeout(MouseEventNormalizer.mouseTrapTimeoutID);
            MouseEventNormalizer.mouseTrapTimeoutID = setTimeout(function() {
                MouseEventNormalizer.captureMouse = false;
                MouseEventNormalizer.bustClick = false;
            }, 400);
        }
    };

    var eventMap = {
        down: "touchstart mousedown",
        move: "mousemove touchmove",
        up: "mouseup touchend touchcancel",
        cancel: "mouseleave touchcancel"
    };

    if (support.touch && (support.mobileOS.ios || support.mobileOS.android)) {
        eventMap = {
            down: "touchstart",
            move: "touchmove",
            up: "touchend touchcancel",
            cancel: "touchcancel"
        };
    }

    if (support.pointers) {
        eventMap = {
            down: "MSPointerDown",
            move: "MSPointerMove",
            up: "MSPointerUp",
            cancel: "MSPointerCancel MSPointerLeave"
        };

        // Create MSPointerEnter/MSPointerLeave events using mouseover/out and event-time checks
        $.each({
            MSPointerEnter: "MSPointerOver",
            MSPointerLeave: "MSPointerOut"
        }, function( orig, fix ) {
            $.event.special[ orig ] = {
                delegateType: fix,
                bindType: fix,

                handle: function( event ) {
                    var ret,
                        target = this,
                        related = event.relatedTarget,
                        handleObj = event.handleObj;

                    // For mousenter/leave call the handler if related is outside the target.
                    // NB: No relatedTarget if the mouse left/entered the browser window
                    if ( !related || (related !== target && !$.contains( target, related )) ) {
                        event.type = handleObj.origType;
                        ret = handleObj.handler.apply( this, arguments );
                        event.type = fix;
                    }
                    return ret;
                }
            };
        });
    }


    var getEventMap = function(e) { return (eventMap[e] || e); },
        eventRegEx = /([^ ]+)/g;

    kendo.applyEventMap = function(events, ns) {
        events = events.replace(eventRegEx, getEventMap);

        if (ns) {
            events = events.replace(eventRegEx, "$1." + ns);
        }

        return events;
    };

    var on = $.fn.on;

    function kendoJQuery(selector, context) {
        return new kendoJQuery.fn.init(selector, context);
    }

    extend(true, kendoJQuery, $);

    kendoJQuery.fn = kendoJQuery.prototype = new $();

    kendoJQuery.fn.constructor = kendoJQuery;

    kendoJQuery.fn.init = function(selector, context) {
        if (context && context instanceof $ && !(context instanceof kendoJQuery)) {
            context = kendoJQuery(context);
        }

        return $.fn.init.call(this, selector, context, rootjQuery);
    };

    kendoJQuery.fn.init.prototype = kendoJQuery.fn;

    var rootjQuery = kendoJQuery(document);

    extend(kendoJQuery.fn, {
        handler: function(handler) {
            this.data("handler", handler);
            return this;
        },

        autoApplyNS: function(ns) {
            this.data("kendoNS", ns || kendo.guid());
            return this;
        },

        on: function() {
            var that = this,
                ns = that.data("kendoNS");

            // support for event map signature
            if (arguments.length === 1) {
                return on.call(that, arguments[0]);
            }

            var context = that,
                args = slice.call(arguments);

            if (typeof args[args.length -1] === UNDEFINED) {
                args.pop();
            }

            var callback =  args[args.length - 1],
                events = kendo.applyEventMap(args[0], ns);

            // setup mouse trap
            if (support.mouseAndTouchPresent && events.search(/mouse|click/) > -1 && this[0] !== document.documentElement) {
                MouseEventNormalizer.setupMouseMute();

                var selector = args.length === 2 ? null : args[1],
                    bustClick = events.indexOf("click") > -1 && events.indexOf("touchend") > -1;

                on.call(this,
                    {
                        touchstart: MouseEventNormalizer.muteMouse,
                        touchend: MouseEventNormalizer.unMuteMouse
                    },
                    selector,
                    {
                        bustClick: bustClick
                    });
            }

            if (typeof callback === STRING) {
                context = that.data("handler");
                callback = context[callback];

                args[args.length - 1] = function(e) {
                    callback.call(context, e);
                };
            }

            args[0] = events;

            on.apply(that, args);

            return that;
        },

        kendoDestroy: function(ns) {
            ns = ns || this.data("kendoNS");

            if (ns) {
                this.off("." + ns);
            }

            return this;
        }
    });

    kendo.jQuery = kendoJQuery;
    kendo.eventMap = eventMap;

    kendo.timezone = (function(){
        var months =  { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
        var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

        function ruleToDate(year, rule) {
            var date;
            var targetDay;
            var ourDay;
            var month = rule[3];
            var on = rule[4];
            var time = rule[5];
            var cache = rule[8];

            if (!cache) {
                rule[8] = cache = {};
            }

            if (cache[year]) {
                return cache[year];
            }

            if (!isNaN(on)) {
                date = new Date(Date.UTC(year, months[month], on, time[0], time[1], time[2], 0));
            } else if (on.indexOf("last") === 0) {
                date = new Date(Date.UTC(year, months[month] + 1, 1, time[0] - 24, time[1], time[2], 0));

                targetDay = days[on.substr(4, 3)];
                ourDay = date.getUTCDay();

                date.setUTCDate(date.getUTCDate() + targetDay - ourDay - (targetDay > ourDay ? 7 : 0));
            } else if (on.indexOf(">=") >= 0) {
                date = new Date(Date.UTC(year, months[month], on.substr(5), time[0], time[1], time[2], 0));

                targetDay = days[on.substr(0, 3)];
                ourDay = date.getUTCDay();

                date.setUTCDate(date.getUTCDate() + targetDay - ourDay + (targetDay < ourDay ? 7 : 0));
            }

            return cache[year] = date;
        }

        function findRule(utcTime, rules, zone) {
            rules = rules[zone];

            if (!rules) {
                var time = zone.split(":");
                var offset = 0;

                if (time.length > 1) {
                    offset = time[0] * 60 + Number(time[1]);
                }

                return [-1000000, 'max', '-', 'Jan', 1, [0, 0, 0], offset, '-'];
            }

            var year = new Date(utcTime).getUTCFullYear();

            rules = jQuery.grep(rules, function(rule) {
                var from = rule[0];
                var to = rule[1];

                return from <= year && (to >= year || (from == year && to == "only") || to == "max");
            });

            rules.push(utcTime);

            rules.sort(function(a, b) {
                if (typeof a != "number") {
                    a = Number(ruleToDate(year, a));
                }

                if (typeof b != "number") {
                    b = Number(ruleToDate(year, b));
                }

                return a - b;
            });

            return rules[jQuery.inArray(utcTime, rules) - 1];
        }

        function findZone(utcTime, zones, timezone) {
            zones = zones[timezone];

            if (!zones) {
                throw new Error('Timezone "' + timezone + '" is either incorrect, or kendo.timezones.min.js is not included.');
            }

            for (var idx = zones.length - 1; idx >= 0; idx--) {
                var until = zones[idx][3];

                if (until && utcTime > until) {
                    break;
                }
            }

            var zone = zones[idx + 1];

            if (!zone) {
                throw new Error('Timezone "' + timezone + '" not found on ' + utcTime + ".");
            }

            return zone;
        }

        function zoneAndRule(utcTime, zones, rules, timezone) {
            if (typeof utcTime != NUMBER) {
                utcTime = Date.UTC(utcTime.getFullYear(), utcTime.getMonth(),
                    utcTime.getDate(), utcTime.getHours(), utcTime.getMinutes(),
                    utcTime.getSeconds(), utcTime.getMilliseconds());
            }

            var zone = findZone(utcTime, zones, timezone);

            return {
                zone: zone,
                rule: findRule(utcTime, rules, zone[1])
            };
        }

        function offset(utcTime, timezone) {
            if (timezone == "Etc/UTC" || timezone == "Etc/GMT") {
                return 0;
            }

            var info = zoneAndRule(utcTime, this.zones, this.rules, timezone);
            var zone = info.zone;
            var rule = info.rule;

            return rule? zone[0] - rule[6] : zone[0];
        }

        function abbr(utcTime, timezone) {
            var info = zoneAndRule(utcTime, this.zones, this.rules, timezone);
            var zone = info.zone;
            var rule = info.rule;

            var base = zone[2];

            if (base.indexOf("/") >= 0) {
                return base.split("/")[rule && rule[6] ? 1 : 0];
            } else if (base.indexOf("%s") >= 0) {
                return base.replace("%s", (!rule || rule[7] == "-") ? '' : rule[7]);
            }

            return base;
        }

        function convert(date, fromOffset, toOffset) {
            if (typeof fromOffset == STRING) {
                fromOffset = this.offset(date, fromOffset);
            }

            if (typeof toOffset == STRING) {
                toOffset = this.offset(date, toOffset);
            }

            var fromLocalOffset = date.getTimezoneOffset();

            date = new Date(date.getTime() + (fromOffset - toOffset) * 60000);

            var toLocalOffset = date.getTimezoneOffset();

            return new Date(date.getTime() + (toLocalOffset - fromLocalOffset) * 60000);
        }

        function apply(date, timezone) {
           return this.convert(date, date.getTimezoneOffset(), timezone);
        }

        function remove(date, timezone) {
           return this.convert(date, timezone, date.getTimezoneOffset());
        }

        return {
           zones: {},
           rules: {},
           offset: offset,
           convert: convert,
           apply: apply,
           remove: remove,
           abbr: abbr
        };
    })();

    kendo.date = (function(){
        var MS_PER_MINUTE = 60000,
            MS_PER_DAY = 86400000;

        function adjustDST(date, hours) {
            if (hours === 0 && date.getHours() === 23) {
                date.setHours(date.getHours() + 2);
                return true;
            }

            return false;
        }

        function setDayOfWeek(date, day, dir) {
            var hours = date.getHours();

            dir = dir || 1;
            day = ((day - date.getDay()) + (7 * dir)) % 7;

            date.setDate(date.getDate() + day);
            adjustDST(date, hours);
        }

        function dayOfWeek(date, day, dir) {
            date = new Date(date);
            setDayOfWeek(date, day, dir);
            return date;
        }

        function firstDayOfMonth(date) {
            return new Date(
                date.getFullYear(),
                date.getMonth(),
                1
            );
        }

        function lastDayOfMonth(date) {
            var last = new Date(date.getFullYear(), date.getMonth() + 1, 0),
                first = firstDayOfMonth(date),
                timeOffset = Math.abs(last.getTimezoneOffset() - first.getTimezoneOffset());

            if (timeOffset) {
                last.setHours(first.getHours() + (timeOffset / 60));
            }

            return last;
        }

        function getDate(date) {
            date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
            adjustDST(date, 0);
            return date;
        }

        function getMilliseconds(date) {
            return date.getHours() * 60 * MS_PER_MINUTE + date.getMinutes() * MS_PER_MINUTE + date.getSeconds() * 1000 + date.getMilliseconds();
        }

        function isInTimeRange(value, min, max) {
            var msMin = getMilliseconds(min),
                msMax = getMilliseconds(max),
                msValue;

            if (!value || msMin == msMax) {
                return true;
            }

            if (min >= max) {
                max += MS_PER_DAY;
            }

            msValue = getMilliseconds(value);

            if (msMin > msValue) {
                msValue += MS_PER_DAY;
            }

            if (msMax < msMin) {
                msMax += MS_PER_DAY;
            }

            return msValue >= msMin && msValue <= msMax;
        }

        function isInDateRange(value, min, max) {
            var msMin = min.getTime(),
                msMax = max.getTime(),
                msValue;

            if (msMin >= msMax) {
                msMax += MS_PER_DAY;
            }

            msValue = value.getTime();

            return msValue >= msMin && msValue <= msMax;
        }

        function addDays(date, offset) {
            var hours = date.getHours();
                date = new Date(date);

            setTime(date, offset * MS_PER_DAY);
            adjustDST(date, hours);
            return date;
        }

        function setTime(date, time, ignoreDST) {
            var offset = date.getTimezoneOffset(),
                offsetDiff;

            date.setTime(date.getTime() + time);

            if (!ignoreDST) {
                offsetDiff = date.getTimezoneOffset() - offset;
                date.setTime(date.getTime() + offsetDiff * MS_PER_MINUTE);
            }
        }

        function today() {
            return getDate(new Date());
        }

        function isToday(date) {
           return getDate(date).getTime() == today().getTime();
        }

        return {
            adjustDST: adjustDST,
            dayOfWeek: dayOfWeek,
            setDayOfWeek: setDayOfWeek,
            getDate: getDate,
            isInDateRange: isInDateRange,
            isInTimeRange: isInTimeRange,
            isToday: isToday,
            nextDay: function(date) {
                return addDays(date, 1);
            },
            previousDay: function(date) {
                return addDays(date, -1);
            },
            MS_PER_DAY: MS_PER_DAY,
            MS_PER_MINUTE: MS_PER_MINUTE,
            setTime: setTime,
            addDays: addDays,
            today: today,
            firstDayOfMonth: firstDayOfMonth,
            lastDayOfMonth: lastDayOfMonth,
            getMilliseconds: getMilliseconds
            //TODO methods: combine date portion and time portion from arguments - date1, date 2
        };
    })();


    kendo.stripWhitespace = function(element) {
        var iterator = document.createNodeIterator(element, NodeFilter.SHOW_TEXT, function(node) {
                return node.parentNode == element ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }, false);

        while (iterator.nextNode()) {
            if (iterator.referenceNode && !iterator.referenceNode.textContent.trim()) {
                iterator.referenceNode.parentNode.removeChild(iterator.referenceNode);
            }
        }
    };

})(jQuery, eval);

/*global kendo_module:true */
if (typeof kendo_module === "undefined") {
    kendo_module = function(){};
}

kendo_module({
    id: "core",
    name: "Core",
    category: "framework",
    description: "The core of the Kendo framework."
});

/*
* Kendo UI Beta v2013.2.716 (http://kendoui.com)
* Copyright 2013 Telerik AD. All rights reserved.
*
* Kendo UI Beta license terms available at
* http://www.kendoui.com/purchase/license-agreement/kendo-ui-beta.aspx
*/

kendo_module({
    id: "data",
    name: "Data source",
    category: "framework",
    description: "Powerful component for using local and remote data.Fully supports CRUD, Sorting, Paging, Filtering, Grouping, and Aggregates.",
    depends: [ "core" ],
    features: [ {
        id: "data-odata",
        name: "OData",
        description: "Support for accessing Open Data Protocol (OData) services.",
        depends: [ "data.odata" ]
    }, {
        id: "data-XML",
        name: "XML",
        description: "Support for binding to XML.",
        depends: [ "data.xml" ]
    } ]
});

(function($, undefined) {
    var extend = $.extend,
        proxy = $.proxy,
        isFunction = $.isFunction,
        isPlainObject = $.isPlainObject,
        isEmptyObject = $.isEmptyObject,
        isArray = $.isArray,
        grep = $.grep,
        ajax = $.ajax,
        map,
        each = $.each,
        noop = $.noop,
        kendo = window.kendo,
        Observable = kendo.Observable,
        Class = kendo.Class,
        STRING = "string",
        FUNCTION = "function",
        CREATE = "create",
        READ = "read",
        UPDATE = "update",
        DESTROY = "destroy",
        CHANGE = "change",
        SYNC = "sync",
        GET = "get",
        ERROR = "error",
        REQUESTSTART = "requestStart",
        PROGRESS = "progress",
        REQUESTEND = "requestEnd",
        crud = [CREATE, READ, UPDATE, DESTROY],
        identity = function(o) { return o; },
        getter = kendo.getter,
        stringify = kendo.stringify,
        math = Math,
        push = [].push,
        join = [].join,
        pop = [].pop,
        splice = [].splice,
        shift = [].shift,
        slice = [].slice,
        unshift = [].unshift,
        toString = {}.toString,
        stableSort = kendo.support.stableSort,
        dateRegExp = /^\/Date\((.*?)\)\/$/,
        newLineRegExp = /(\r+|\n+)/g,
        quoteRegExp = /(?=['\\])/g;

    var ObservableArray = Observable.extend({
        init: function(array, type) {
            var that = this;

            that.type = type || ObservableObject;

            Observable.fn.init.call(that);

            that.length = array.length;

            that.wrapAll(array, that);
        },

        toJSON: function() {
            var idx, length = this.length, value, json = new Array(length);

            for (idx = 0; idx < length; idx++){
                value = this[idx];

                if (value instanceof ObservableObject) {
                    value = value.toJSON();
                }

                json[idx] = value;
            }

            return json;
        },

        parent: noop,

        wrapAll: function(source, target) {
            var that = this,
                idx,
                length,
                parent = function() {
                    return that;
                };

            target = target || [];

            for (idx = 0, length = source.length; idx < length; idx++) {
                target[idx] = that.wrap(source[idx], parent);
            }

            return target;
        },

        wrap: function(object, parent) {
            var that = this,
                observable;

            if (object !== null && toString.call(object) === "[object Object]") {
                observable = object instanceof that.type || object instanceof Model;

                if (!observable) {
                    object = object instanceof ObservableObject ? object.toJSON() : object;
                    object = new that.type(object);
                }

                object.parent = parent;

                object.bind(CHANGE, function(e) {
                    that.trigger(CHANGE, {
                        field: e.field,
                        node: e.node,
                        index: e.index,
                        items: e.items || [this],
                        action: e.node  ? (e.action || "itemchange") : "itemchange"
                    });
                });
            }

            return object;
        },

        push: function() {
            var index = this.length,
                items = this.wrapAll(arguments),
                result;

            result = push.apply(this, items);

            this.trigger(CHANGE, {
                action: "add",
                index: index,
                items: items
            });

            return result;
        },

        slice: slice,

        join: join,

        pop: function() {
            var length = this.length, result = pop.apply(this);

            if (length) {
                this.trigger(CHANGE, {
                    action: "remove",
                    index: length - 1,
                    items:[result]
                });
            }

            return result;
        },

        splice: function(index, howMany, item) {
            var items = this.wrapAll(slice.call(arguments, 2)),
                result, i, len;

            result = splice.apply(this, [index, howMany].concat(items));

            if (result.length) {
                this.trigger(CHANGE, {
                    action: "remove",
                    index: index,
                    items: result
                });

                for (i = 0, len = result.length; i < len; i++) {
                    if (result[i].children) {
                        result[i].unbind(CHANGE);
                    }
                }
            }

            if (item) {
                this.trigger(CHANGE, {
                    action: "add",
                    index: index,
                    items: items
                });
            }
            return result;
        },

        shift: function() {
            var length = this.length, result = shift.apply(this);

            if (length) {
                this.trigger(CHANGE, {
                    action: "remove",
                    index: 0,
                    items:[result]
                });
            }

            return result;
        },

        unshift: function() {
            var items = this.wrapAll(arguments),
                result;

            result = unshift.apply(this, items);

            this.trigger(CHANGE, {
                action: "add",
                index: 0,
                items: items
            });

            return result;
        },

        indexOf: function(item) {
            var that = this,
                idx,
                length;

            for (idx = 0, length = that.length; idx < length; idx++) {
                if (that[idx] === item) {
                    return idx;
                }
            }
            return -1;
        },

        forEach: function(callback) {
            var idx = 0,
                length = this.length;

            for (; idx < length; idx++) {
                callback(this[idx], idx, this);
            }
        },

        map: function(callback) {
            var idx = 0,
                result = [],
                length = this.length;

            for (; idx < length; idx++) {
                result[idx] = callback(this[idx], idx, this);
            }

            return result;
        },

        filter: function(callback) {
            var idx = 0,
                result = [],
                item,
                length = this.length;

            for (; idx < length; idx++) {
                item = this[idx];
                if (callback(item, idx, this)) {
                    result[result.length] = item;
                }
            }

            return result;
        },

        find: function(callback) {
            var idx = 0,
                item,
                length = this.length;

            for (; idx < length; idx++) {
                item = this[idx];
                if (callback(item, idx, this)) {
                    return item;
                }
            }
        },

        every: function(callback) {
            var idx = 0,
                item,
                length = this.length;

            for (; idx < length; idx++) {
                item = this[idx];
                if (!callback(item, idx, this)) {
                    return false;
                }
            }

            return true;
        },

        some: function(callback) {
            var idx = 0,
                item,
                length = this.length;

            for (; idx < length; idx++) {
                item = this[idx];
                if (callback(item, idx, this)) {
                    return true;
                }
            }

            return false;
        },

        // non-standard collection methods
        remove: function(item) {
            this.splice(this.indexOf(item), 1);
        }
    });

    function eventHandler(context, type, field, prefix) {
        return function(e) {
            var event = {}, key;

            for (key in e) {
                event[key] = e[key];
            }

            if (prefix) {
                event.field = field + "." + e.field;
            } else {
                event.field = field;
            }

            context.trigger(type, event);

            if (type == CHANGE && context._notifyChange) {
                context._notifyChange(event);
            }
        };
    }

    var ObservableObject = Observable.extend({
        init: function(value) {
            var that = this,
                member,
                field,
                parent = function() {
                    return that;
                };

            Observable.fn.init.call(this);

            for (field in value) {
                member = value[field];

                if (field.charAt(0) != "_") {
                    member = that.wrap(member, field, parent);
                }

                that[field] = member;
            }

            that.uid = kendo.guid();
        },

        shouldSerialize: function(field) {
            return this.hasOwnProperty(field) && field !== "_events" && typeof this[field] !== FUNCTION && field !== "uid";
        },

        forEach: function(f) {
            for (var i in this) {
                if (this.shouldSerialize(i)) {
                    f(this[i], i);
                }
            }
        },

        toJSON: function() {
            var result = {}, value, field;

            for (field in this) {
                if (this.shouldSerialize(field)) {
                    value = this[field];

                    if (value instanceof ObservableObject || value instanceof ObservableArray) {
                        value = value.toJSON();
                    }

                    result[field] = value;
                }
            }

            return result;
        },

        get: function(field) {
            var that = this, result;

            that.trigger(GET, { field: field });

            if (field === "this") {
                result = that;
            } else {
                result = kendo.getter(field, true)(that);
            }

            return result;
        },

        _set: function(field, value) {
            var that = this;
            var composite = field.indexOf(".") >= 0;

            if (composite) {
                var paths = field.split("."),
                    path = "";

                while (paths.length > 1) {
                    path += paths.shift();
                    var obj = kendo.getter(path, true)(that);
                    if (obj instanceof ObservableObject) {
                        obj.set(paths.join("."), value);
                        return composite;
                    }
                    path += ".";
                }
            }

            kendo.setter(field)(that, value);

            return composite;
        },

        set: function(field, value) {
            var that = this,
                current = kendo.getter(field, true)(that);

            if (current !== value) {

                if (!that.trigger("set", { field: field, value: value })) {
                    if (!that._set(field, that.wrap(value, field, function() { return that; })) || field.indexOf("(") >= 0 || field.indexOf("[") >= 0) {
                        that.trigger(CHANGE, { field: field });
                    }
                }
            }
        },

        parent: noop,

        wrap: function(object, field, parent) {
            var that = this,
                type = toString.call(object);

            if (object != null && (type === "[object Object]" || type === "[object Array]")) {
                var isObservableArray = object instanceof ObservableArray;
                var isDataSource = object instanceof DataSource;

                if (type === "[object Object]" && !isDataSource && !isObservableArray) {
                    if (!(object instanceof ObservableObject)) {
                        object = new ObservableObject(object);
                    }

                    if (object.parent() != parent()) {
                        object.bind(GET, eventHandler(that, GET, field, true));
                        object.bind(CHANGE, eventHandler(that, CHANGE, field, true));
                    }
                } else if (type === "[object Array]" || isObservableArray || isDataSource) {
                    if (!isObservableArray && !isDataSource) {
                        object = new ObservableArray(object);
                    }

                    if (object.parent() != parent()) {
                        object.bind(CHANGE, eventHandler(that, CHANGE, field, false));
                    }
                }

                object.parent = parent;
            }

            return object;
        }
    });

    function equal(x, y) {
        if (x === y) {
            return true;
        }

        var xtype = $.type(x), ytype = $.type(y), field;

        if (xtype !== ytype) {
            return false;
        }

        if (xtype === "date") {
            return x.getTime() === y.getTime();
        }

        if (xtype !== "object" && xtype !== "array") {
            return false;
        }

        for (field in x) {
            if (!equal(x[field], y[field])) {
                return false;
            }
        }

        return true;
    }

    var parsers = {
        "number": function(value) {
            return kendo.parseFloat(value);
        },

        "date": function(value) {
            return kendo.parseDate(value);
        },

        "boolean": function(value) {
            if (typeof value === STRING) {
                return value.toLowerCase() === "true";
            }
            return value != null ? !!value : value;
        },

        "string": function(value) {
            return value != null ? (value + "") : value;
        },

        "default": function(value) {
            return value;
        }
    };

    var defaultValues = {
        "string": "",
        "number": 0,
        "date": new Date(),
        "boolean": false,
        "default": ""
    };

    function getFieldByName(obj, name) {
        var field,
            fieldName;

        for (fieldName in obj) {
            field = obj[fieldName];
            if (isPlainObject(field) && field.field && field.field === name) {
                return field;
            } else if (field === name) {
                return field;
            }
        }
        return null;
    }

    var Model = ObservableObject.extend({
        init: function(data) {
            var that = this;

            if (!data || $.isEmptyObject(data)) {
                data = $.extend({}, that.defaults, data);
            }

            ObservableObject.fn.init.call(that, data);

            that.dirty = false;

            if (that.idField) {
                that.id = that.get(that.idField);

                if (that.id === undefined) {
                    that.id = that._defaultId;
                }
            }
        },

        shouldSerialize: function(field) {
            return ObservableObject.fn.shouldSerialize.call(this, field) && field !== "uid" && !(this.idField !== "id" && field === "id") && field !== "dirty" && field !== "_accessors";
        },

        _parse: function(field, value) {
            var that = this,
                fieldName = field,
                fields = (that.fields || {}),
                parse;

            field = fields[field];
            if (!field) {
                field = getFieldByName(fields, fieldName);
            }
            if (field) {
                parse = field.parse;
                if (!parse && field.type) {
                    parse = parsers[field.type.toLowerCase()];
                }
            }

            return parse ? parse(value) : value;
        },

        _notifyChange: function(e) {
            var action = e.action;

            if (action == "add" || action == "remove") {
                this.dirty = true;
            }
        },

        editable: function(field) {
            field = (this.fields || {})[field];
            return field ? field.editable !== false : true;
        },

        set: function(field, value, initiator) {
            var that = this;

            if (that.editable(field)) {
                value = that._parse(field, value);

                if (!equal(value, that.get(field))) {
                    that.dirty = true;
                    ObservableObject.fn.set.call(that, field, value, initiator);
                }
            }
        },

        accept: function(data) {
            var that = this,
                parent = function() { return that; },
                field;

            for (field in data) {
                that._set(field, that.wrap(data[field], field, parent));
            }

            if (that.idField) {
                that.id = that.get(that.idField);
            }

            that.dirty = false;
        },

        isNew: function() {
            return this.id === this._defaultId;
        }
    });

    Model.define = function(base, options) {
        if (options === undefined) {
            options = base;
            base = Model;
        }

        var model,
            proto = extend({ defaults: {} }, options),
            name,
            field,
            type,
            value,
            idx,
            length,
            fields = {},
            originalName,
            id = proto.id;

        if (id) {
            proto.idField = id;
        }

        if (proto.id) {
            delete proto.id;
        }

        if (id) {
            proto.defaults[id] = proto._defaultId = "";
        }

        if (toString.call(proto.fields) === "[object Array]") {
            for (idx = 0, length = proto.fields.length; idx < length; idx++) {
                field = proto.fields[idx];
                if (typeof field === STRING) {
                    fields[field] = {};
                } else if (field.field) {
                    fields[field.field] = field;
                }
            }
            proto.fields = fields;
        }

        for (name in proto.fields) {
            field = proto.fields[name];
            type = field.type || "default";
            value = null;
            originalName = name;

            name = typeof (field.field) === STRING ? field.field : name;

            if (!field.nullable) {
                value = proto.defaults[originalName !== name ? originalName : name] = field.defaultValue !== undefined ? field.defaultValue : defaultValues[type.toLowerCase()];
            }

            if (options.id === name) {
                proto._defaultId = value;
            }

            proto.defaults[originalName !== name ? originalName : name] = value;

            field.parse = field.parse || parsers[type];
        }

        model = base.extend(proto);
        model.define = function(options) {
            return Model.define(model, options);
        };

        if (proto.fields) {
            model.fields = proto.fields;
            model.idField = proto.idField;
        }

        return model;
    };

    var Comparer = {
        selector: function(field) {
            return isFunction(field) ? field : getter(field);
        },

        compare: function(field) {
            var selector = this.selector(field);
            return function (a, b) {
                a = selector(a);
                b = selector(b);

                if (a == null && b == null) {
                    return 0;
                }

                if (a == null) {
                    return -1;
                }

                if (b == null) {
                    return 1;
                }

                if (a.localeCompare) {
                    return a.localeCompare(b);
                }

                return a > b ? 1 : (a < b ? -1 : 0);
            };
        },

        create: function(sort) {
            var compare = sort.compare || this.compare(sort.field);

            if (sort.dir == "desc") {
                return function(a, b) {
                    return compare(b, a, true);
                };
            }

            return compare;
        },

        combine: function(comparers) {
            return function(a, b) {
                var result = comparers[0](a, b),
                    idx,
                    length;

                for (idx = 1, length = comparers.length; idx < length; idx ++) {
                    result = result || comparers[idx](a, b);
                }

                return result;
            };
        }
    };

    var StableComparer = extend({}, Comparer, {
        asc: function(field) {
            var selector = this.selector(field);
            return function (a, b) {
                var valueA = selector(a);
                var valueB = selector(b);

                if (valueA && valueA.getTime && valueB && valueB.getTime) {
                    valueA = valueA.getTime();
                    valueB = valueB.getTime();
                }

                if (valueA === valueB) {
                    return a.__position - b.__position;
                }

                if (valueA == null) {
                    return -1;
                }

                if (valueB == null) {
                    return 1;
                }

                if (valueA.localeCompare) {
                    return valueA.localeCompare(valueB);
                }

                return valueA > valueB ? 1 : -1;
            };
        },

        desc: function(field) {
            var selector = this.selector(field);
            return function (a, b) {
                var valueA = selector(a);
                var valueB = selector(b);

                if (valueA && valueA.getTime && valueB && valueB.getTime) {
                    valueA = valueA.getTime();
                    valueB = valueB.getTime();
                }

                if (valueA === valueB) {
                    return a.__position - b.__position;
                }

                if (valueA == null) {
                    return 1;
                }

                if (valueB == null) {
                    return -1;
                }

                if (valueB.localeCompare) {
                    return valueB.localeCompare(valueA);
                }

                return valueA < valueB ? 1 : -1;
            };
        },
        create: function(sort) {
           return this[sort.dir](sort.field);
        }
    });

    map = function (array, callback) {
        var idx, length = array.length, result = new Array(length);

        for (idx = 0; idx < length; idx++) {
            result[idx] = callback(array[idx], idx, array);
        }

        return result;
    };

    var operators = (function(){

        function quote(value) {
            return value.replace(quoteRegExp, "\\").replace(newLineRegExp, "");
        }

        function operator(op, a, b, ignore) {
            var date;

            if (b != null) {
                if (typeof b === STRING) {
                    b = quote(b);
                    date = dateRegExp.exec(b);
                    if (date) {
                        b = new Date(+date[1]);
                    } else if (ignore) {
                        b = "'" + b.toLowerCase() + "'";
                        a = "(" + a + " || '').toLowerCase()";
                    } else {
                        b = "'" + b + "'";
                    }
                }

                if (b.getTime) {
                    //b looks like a Date
                    a = "(" + a + "?" + a + ".getTime():" + a + ")";
                    b = b.getTime();
                }
            }

            return a + " " + op + " " + b;
        }

        return {
            eq: function(a, b, ignore) {
                return operator("==", a, b, ignore);
            },
            neq: function(a, b, ignore) {
                return operator("!=", a, b, ignore);
            },
            gt: function(a, b, ignore) {
                return operator(">", a, b, ignore);
            },
            gte: function(a, b, ignore) {
                return operator(">=", a, b, ignore);
            },
            lt: function(a, b, ignore) {
                return operator("<", a, b, ignore);
            },
            lte: function(a, b, ignore) {
                return operator("<=", a, b, ignore);
            },
            startswith: function(a, b, ignore) {
                if (ignore) {
                    a = "(" + a + " || '').toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".lastIndexOf('" + b + "', 0) == 0";
            },
            endswith: function(a, b, ignore) {
                if (ignore) {
                    a = "(" + a + " || '').toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".indexOf('" + b + "', " + a + ".length - " + (b || "").length + ") >= 0";
            },
            contains: function(a, b, ignore) {
                if (ignore) {
                    a = "(" + a + " || '').toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".indexOf('" + b + "') >= 0";
            },
            doesnotcontain: function(a, b, ignore) {
                if (ignore) {
                    a = "(" + a + " || '').toLowerCase()";
                    if (b) {
                        b = b.toLowerCase();
                    }
                }

                if (b) {
                    b = quote(b);
                }

                return a + ".indexOf('" + b + "') == -1";
            }
        };
    })();

    function Query(data) {
        this.data = data || [];
    }

    Query.filterExpr = function(expression) {
        var expressions = [],
            logic = { and: " && ", or: " || " },
            idx,
            length,
            filter,
            expr,
            fieldFunctions = [],
            operatorFunctions = [],
            field,
            operator,
            filters = expression.filters;

        for (idx = 0, length = filters.length; idx < length; idx++) {
            filter = filters[idx];
            field = filter.field;
            operator = filter.operator;

            if (filter.filters) {
                expr = Query.filterExpr(filter);
                //Nested function fields or operators - update their index e.g. __o[0] -> __o[1]
                filter = expr.expression
                .replace(/__o\[(\d+)\]/g, function(match, index) {
                    index = +index;
                    return "__o[" + (operatorFunctions.length + index) + "]";
                })
                .replace(/__f\[(\d+)\]/g, function(match, index) {
                    index = +index;
                    return "__f[" + (fieldFunctions.length + index) + "]";
                });

                operatorFunctions.push.apply(operatorFunctions, expr.operators);
                fieldFunctions.push.apply(fieldFunctions, expr.fields);
            } else {
                if (typeof field === FUNCTION) {
                    expr = "__f[" + fieldFunctions.length +"](d)";
                    fieldFunctions.push(field);
                } else {
                    expr = kendo.expr(field);
                }

                if (typeof operator === FUNCTION) {
                    filter = "__o[" + operatorFunctions.length + "](" + expr + ", " + filter.value + ")";
                    operatorFunctions.push(operator);
                } else {
                    filter = operators[(operator || "eq").toLowerCase()](expr, filter.value, filter.ignoreCase !== undefined? filter.ignoreCase : true);
                }
            }

            expressions.push(filter);
        }

        return  { expression: "(" + expressions.join(logic[expression.logic]) + ")", fields: fieldFunctions, operators: operatorFunctions };
    };

    function normalizeSort(field, dir) {
        if (field) {
            var descriptor = typeof field === STRING ? { field: field, dir: dir } : field,
            descriptors = isArray(descriptor) ? descriptor : (descriptor !== undefined ? [descriptor] : []);

            return grep(descriptors, function(d) { return !!d.dir; });
        }
    }

    var operatorMap = {
        "==": "eq",
        equals: "eq",
        isequalto: "eq",
        equalto: "eq",
        equal: "eq",
        "!=": "neq",
        ne: "neq",
        notequals: "neq",
        isnotequalto: "neq",
        notequalto: "neq",
        notequal: "neq",
        "<": "lt",
        islessthan: "lt",
        lessthan: "lt",
        less: "lt",
        "<=": "lte",
        le: "lte",
        islessthanorequalto: "lte",
        lessthanequal: "lte",
        ">": "gt",
        isgreaterthan: "gt",
        greaterthan: "gt",
        greater: "gt",
        ">=": "gte",
        isgreaterthanorequalto: "gte",
        greaterthanequal: "gte",
        ge: "gte",
        notsubstringof: "doesnotcontain"
    };

    function normalizeOperator(expression) {
        var idx,
        length,
        filter,
        operator,
        filters = expression.filters;

        if (filters) {
            for (idx = 0, length = filters.length; idx < length; idx++) {
                filter = filters[idx];
                operator = filter.operator;

                if (operator && typeof operator === STRING) {
                    filter.operator = operatorMap[operator.toLowerCase()] || operator;
                }

                normalizeOperator(filter);
            }
        }
    }

    function normalizeFilter(expression) {
        if (expression && !isEmptyObject(expression)) {
            if (isArray(expression) || !expression.filters) {
                expression = {
                    logic: "and",
                    filters: isArray(expression) ? expression : [expression]
                };
            }

            normalizeOperator(expression);

            return expression;
        }
    }

    Query.normalizeFilter = normalizeFilter;

    function normalizeAggregate(expressions) {
        return isArray(expressions) ? expressions : [expressions];
    }

    function normalizeGroup(field, dir) {
        var descriptor = typeof field === STRING ? { field: field, dir: dir } : field,
        descriptors = isArray(descriptor) ? descriptor : (descriptor !== undefined ? [descriptor] : []);

        return map(descriptors, function(d) { return { field: d.field, dir: d.dir || "asc", aggregates: d.aggregates }; });
    }

    Query.prototype = {
        toArray: function () {
            return this.data;
        },
        range: function(index, count) {
            return new Query(this.data.slice(index, index + count));
        },
        skip: function (count) {
            return new Query(this.data.slice(count));
        },
        take: function (count) {
            return new Query(this.data.slice(0, count));
        },
        select: function (selector) {
            return new Query(map(this.data, selector));
        },
        order: function(selector, dir) {
            var sort = { dir: dir };

            if (selector) {
                if (selector.compare) {
                    sort.compare = selector.compare;
                } else {
                    sort.field = selector;
                }
            }

            return new Query(this.data.slice(0).sort(Comparer.create(sort)));
        },
        orderBy: function(selector) {
            return this.order(selector, "asc");
        },
        orderByDescending: function(selector) {
            return this.order(selector, "desc");
        },
        sort: function(field, dir, comparer) {
            var idx,
            length,
            descriptors = normalizeSort(field, dir),
            comparers = [];

            comparer = comparer || Comparer;

            if (descriptors.length) {
                for (idx = 0, length = descriptors.length; idx < length; idx++) {
                    comparers.push(comparer.create(descriptors[idx]));
                }

                return this.orderBy({ compare: comparer.combine(comparers) });
            }

            return this;
        },

        filter: function(expressions) {
            var idx,
            current,
            length,
            compiled,
            predicate,
            data = this.data,
            fields,
            operators,
            result = [],
            filter;

            expressions = normalizeFilter(expressions);

            if (!expressions || expressions.filters.length === 0) {
                return this;
            }

            compiled = Query.filterExpr(expressions);
            fields = compiled.fields;
            operators = compiled.operators;

            predicate = filter = new Function("d, __f, __o", "return " + compiled.expression);

            if (fields.length || operators.length) {
                filter = function(d) {
                    return predicate(d, fields, operators);
                };
            }

            for (idx = 0, length = data.length; idx < length; idx++) {
                current = data[idx];

                if (filter(current)) {
                    result.push(current);
                }
            }
            return new Query(result);
        },

        group: function(descriptors, allData) {
            descriptors =  normalizeGroup(descriptors || []);
            allData = allData || this.data;

            var that = this,
            result = new Query(that.data),
            descriptor;

            if (descriptors.length > 0) {
                descriptor = descriptors[0];
                result = result.groupBy(descriptor).select(function(group) {
                    var data = new Query(allData).filter([ { field: group.field, operator: "eq", value: group.value } ]);
                    return {
                        field: group.field,
                        value: group.value,
                        items: descriptors.length > 1 ? new Query(group.items).group(descriptors.slice(1), data.toArray()).toArray() : group.items,
                        hasSubgroups: descriptors.length > 1,
                        aggregates: data.aggregate(descriptor.aggregates)
                    };
                });
            }
            return result;
        },

        groupBy: function(descriptor) {
            if (isEmptyObject(descriptor) || !this.data.length) {
                return new Query([]);
            }

            var field = descriptor.field,
                sorted = this._sortForGrouping(field, descriptor.dir || "asc"),
                accessor = kendo.accessor(field),
                item,
                groupValue = accessor.get(sorted[0], field),
                group = {
                    field: field,
                    value: groupValue,
                    items: []
                },
                currentValue,
                idx,
                len,
                result = [group];

            for(idx = 0, len = sorted.length; idx < len; idx++) {
                item = sorted[idx];
                currentValue = accessor.get(item, field);
                if(!groupValueComparer(groupValue, currentValue)) {
                    groupValue = currentValue;
                    group = {
                        field: field,
                        value: groupValue,
                        items: []
                    };
                    result.push(group);
                }
                group.items.push(item);
            }
            return new Query(result);
        },

        _sortForGrouping: function(field, dir) {
            var idx, length,
                data = this.data;

            if (!stableSort) {
                for (idx = 0, length = data.length; idx < length; idx++) {
                    data[idx].__position = idx;
                }

                data = new Query(data).sort(field, dir, StableComparer).toArray();

                for (idx = 0, length = data.length; idx < length; idx++) {
                    delete data[idx].__position;
                }
                return data;
            }
            return this.sort(field, dir).toArray();
        },

        aggregate: function (aggregates) {
            var idx,
            len,
            result = {};

            if (aggregates && aggregates.length) {
                for(idx = 0, len = this.data.length; idx < len; idx++) {
                    calculateAggregate(result, aggregates, this.data[idx], idx, len);
                }
            }
            return result;
        }
    };

    function groupValueComparer(a, b) {
        if (a && a.getTime && b && b.getTime) {
            return a.getTime() === b.getTime();
        }
        return a === b;
    }

    function calculateAggregate(accumulator, aggregates, item, index, length) {
        aggregates = aggregates || [];
        var idx,
        aggr,
        functionName,
        len = aggregates.length;

        for (idx = 0; idx < len; idx++) {
            aggr = aggregates[idx];
            functionName = aggr.aggregate;
            var field = aggr.field;
            accumulator[field] = accumulator[field] || {};
            accumulator[field][functionName] = functions[functionName.toLowerCase()](accumulator[field][functionName], item, kendo.accessor(field), index, length);
        }
    }

    var functions = {
        sum: function(accumulator, item, accessor) {
            return (accumulator || 0) + accessor.get(item);
        },
        count: function(accumulator) {
            return (accumulator || 0) + 1;
        },
        average: function(accumulator, item, accessor, index, length) {
            accumulator = (accumulator || 0) + accessor.get(item);
            if(index == length - 1) {
                accumulator = accumulator / length;
            }
            return accumulator;
        },
        max: function(accumulator, item, accessor) {
            var value = accessor.get(item);

            accumulator = accumulator || 0;

            if(accumulator < value) {
                accumulator = value;
            }
            return accumulator;
        },
        min: function(accumulator, item, accessor) {
            var value = accessor.get(item);

            accumulator = (accumulator || value);

            if(accumulator > value) {
                accumulator = value;
            }
            return accumulator;
        }
    };

    function toJSON(array) {
        var idx, length = array.length, result = new Array(length);

        for (idx = 0; idx < length; idx++) {
            result[idx] = array[idx].toJSON();
        }

        return result;
    }

    Query.process = function(data, options) {
        options = options || {};

        var query = new Query(data),
            group = options.group,
            sort = normalizeGroup(group || []).concat(normalizeSort(options.sort || [])),
            total,
            filter = options.filter,
            skip = options.skip,
            take = options.take;

        if (filter) {
            query = query.filter(filter);
            total = query.toArray().length;
        }

        if (sort) {
            query = query.sort(sort);

            if (group) {
                data = query.toArray();
            }
        }

        if (skip !== undefined && take !== undefined) {
            query = query.range(skip, take);
        }

        if (group) {
            query = query.group(group, data);
        }

        return {
            total: total,
            data: query.toArray()
        };
    };

    function calculateAggregates(data, options) {
        options = options || {};

        var query = new Query(data),
            aggregates = options.aggregate,
            filter = options.filter;

        if(filter) {
            query = query.filter(filter);
        }

        return query.aggregate(aggregates);
    }

    var LocalTransport = Class.extend({
        init: function(options) {
            this.data = options.data;
        },

        read: function(options) {
            options.success(this.data);
        },
        update: function(options) {
            options.success(options.data);
        },
        create: function(options) {
            options.success(options.data);
        },
        destroy: function(options) {
            options.success(options.data);
        }
    });

    var RemoteTransport = Class.extend( {
        init: function(options) {
            var that = this, parameterMap;

            options = that.options = extend({}, that.options, options);

            each(crud, function(index, type) {
                if (typeof options[type] === STRING) {
                    options[type] = {
                        url: options[type]
                    };
                }
            });

            that.cache = options.cache? Cache.create(options.cache) : {
                find: noop,
                add: noop
            };

            parameterMap = options.parameterMap;

            that.parameterMap = isFunction(parameterMap) ? parameterMap : function(options) {
                var result = {};

                each(options, function(option, value) {
                    if (option in parameterMap) {
                        option = parameterMap[option];
                        if (isPlainObject(option)) {
                            value = option.value(value);
                            option = option.key;
                        }
                    }

                    result[option] = value;
                });

                return result;
            };
        },

        options: {
            parameterMap: identity
        },

        create: function(options) {
            return ajax(this.setup(options, CREATE));
        },

        read: function(options) {
            var that = this,
                success,
                error,
                result,
                cache = that.cache;

            options = that.setup(options, READ);

            success = options.success || noop;
            error = options.error || noop;

            result = cache.find(options.data);

            if(result !== undefined) {
                success(result);
            } else {
                options.success = function(result) {
                    cache.add(options.data, result);

                    success(result);
                };

                $.ajax(options);
            }
        },

        update: function(options) {
            return ajax(this.setup(options, UPDATE));
        },

        destroy: function(options) {
            return ajax(this.setup(options, DESTROY));
        },

        setup: function(options, type) {
            options = options || {};

            var that = this,
                parameters,
                operation = that.options[type],
                data = isFunction(operation.data) ? operation.data(options.data) : operation.data;

            options = extend(true, {}, operation, options);
            parameters = extend(true, {}, data, options.data);

            options.data = that.parameterMap(parameters, type);

            if (isFunction(options.url)) {
                options.url = options.url(parameters);
            }

            return options;
        }
    });

    var Cache = Class.extend({
        init: function() {
            this._store = {};
        },
        add: function(key, data) {
            if(key !== undefined) {
                this._store[stringify(key)] = data;
            }
        },
        find: function(key) {
            return this._store[stringify(key)];
        },
        clear: function() {
            this._store = {};
        },
        remove: function(key) {
            delete this._store[stringify(key)];
        }
    });

    Cache.create = function(options) {
        var store = {
            "inmemory": function() { return new Cache(); }
        };

        if (isPlainObject(options) && isFunction(options.find)) {
            return options;
        }

        if (options === true) {
            return new Cache();
        }

        return store[options]();
    };

    function serializeRecords(data, getters, modelInstance, originalFieldNames, fieldNames) {
        var record,
            getter,
            originalName,
            idx,
            length;

        for (idx = 0, length = data.length; idx < length; idx++) {
            record = data[idx];
            for (getter in getters) {
                originalName = fieldNames[getter];

                if (originalName && originalName !== getter) {
                    record[originalName] = getters[getter](record);
                    delete record[getter];
                }
            }
        }
    }

    function convertRecords(data, getters, modelInstance, originalFieldNames, fieldNames) {
        var record,
            getter,
            originalName,
            idx,
            length;

        for (idx = 0, length = data.length; idx < length; idx++) {
            record = data[idx];
            for (getter in getters) {
                record[getter] = modelInstance._parse(getter, getters[getter](record));

                originalName = fieldNames[getter];
                if (originalName && originalName !== getter) {
                    delete record[originalName];
                }
            }
        }
    }

    function convertGroup(data, getters, modelInstance, originalFieldNames, fieldNames) {
        var record,
            idx,
            fieldName,
            length;

        for (idx = 0, length = data.length; idx < length; idx++) {
            record = data[idx];

            fieldName = originalFieldNames[record.field];
            if (fieldName && fieldName != record.field) {
                record.field = fieldName;
            }

            record.value = modelInstance._parse(record.field, record.value);

            if (record.hasSubgroups) {
                convertGroup(record.items, getters, modelInstance, originalFieldNames, fieldNames);
            } else {
                convertRecords(record.items, getters, modelInstance, originalFieldNames, fieldNames);
            }
        }
    }

    function wrapDataAccess(originalFunction, model, converter, getters, originalFieldNames, fieldNames) {
        return function(data) {
            data = originalFunction(data);

            if (data && !isEmptyObject(getters)) {
                if (toString.call(data) !== "[object Array]" && !(data instanceof ObservableArray)) {
                    data = [data];
                }

                converter(data, getters, new model(), originalFieldNames, fieldNames);
            }

            return data || [];
        };
    }

    var DataReader = Class.extend({
        init: function(schema) {
            var that = this, member, get, model, base;

            schema = schema || {};

            for (member in schema) {
                get = schema[member];

                that[member] = typeof get === STRING ? getter(get) : get;
            }

            base = schema.modelBase || Model;

            if (isPlainObject(that.model)) {
                that.model = model = base.define(that.model);
            }

            if (that.model) {
                var dataFunction = proxy(that.data, that),
                    groupsFunction = proxy(that.groups, that),
                    serializeFunction = proxy(that.serialize, that),
                    originalFieldNames = {},
                    getters = {},
                    serializeGetters = {},
                    fieldNames = {},
                    shouldSerialize = false,
                    fieldName;

                model = that.model;

                if (model.fields) {
                    each(model.fields, function(field, value) {
                        var fromName;

                        fieldName = field;

                        if (isPlainObject(value) && value.field) {
                            fieldName = value.field;
                        } else if (typeof value === STRING) {
                            fieldName = value;
                        }

                        if (isPlainObject(value) && value.from) {
                            fromName = value.from;
                        }

                        shouldSerialize = shouldSerialize || (fromName && fromName !== field) || fieldName !== field;

                        getters[field] = getter(fromName || fieldName);
                        serializeGetters[field] = getter(field);
                        originalFieldNames[fromName || fieldName] = field;
                        fieldNames[field] = fromName || fieldName;
                    });

                    if (!schema.serialize && shouldSerialize) {
                        that.serialize = wrapDataAccess(serializeFunction, model, serializeRecords, serializeGetters, originalFieldNames, fieldNames);
                    }
                }

                that.data = wrapDataAccess(dataFunction, model, convertRecords, getters, originalFieldNames, fieldNames);
                that.groups = wrapDataAccess(groupsFunction, model, convertGroup, getters, originalFieldNames, fieldNames);
            }
        },
        errors: function(data) {
            return data ? data.errors : null;
        },
        parse: identity,
        data: identity,
        total: function(data) {
            return data.length;
        },
        groups: identity,
        aggregates: function() {
            return {};
        },
        serialize: function(data) {
            return data;
        }
    });

    function mergeGroups(target, dest, start, count) {
        var group,
            idx = 0,
            items;

        while (dest.length && count) {
            group = dest[idx];
            items = group.items;

            if (target && target.field === group.field && target.value === group.value) {
                if (target.hasSubgroups && target.items.length) {
                    mergeGroups(target.items[target.items.length - 1], group.items, start, count);
                } else {
                    items = items.slice(start, count);
                    count -= items.length;
                    target.items = target.items.concat(items);
                }
                dest.splice(idx--, 1);
            } else {
                items = items.slice(start, count);
                count -= items.length;
                group.items = items;
                if (!group.items.length) {
                    dest.splice(idx--, 1);
                }
            }

            start = 0;
            if (++idx >= dest.length) {
                break;
            }
        }
    }

    function flattenGroups(data) {
        var idx, length, result = [];

        for (idx = 0, length = data.length; idx < length; idx++) {
            if (data[idx].hasSubgroups) {
                result = result.concat(flattenGroups(data[idx].items));
            } else {
                result = result.concat(data[idx].items.slice());
            }
        }
        return result;
    }

    function wrapGroupItems(data, model) {
        var idx, length, group, items;
        if (model) {
            for (idx = 0, length = data.length; idx < length; idx++) {
                group = data[idx];
                items = group.items;

                if (group.hasSubgroups) {
                    wrapGroupItems(items, model);
                } else if (items.length && !(items[0] instanceof model)) {
                    items.type = model;
                    items.wrapAll(items, items);
                }
            }
        }
    }

    function eachGroupItems(data, func) {
        var idx, length;

        for (idx = 0, length = data.length; idx < length; idx++) {
            if (data[idx].hasSubgroups) {
                if (eachGroupItems(data[idx].items, func)) {
                    return true;
                }
            } else if (func(data[idx].items, data[idx])) {
                return true;
            }
        }
    }

    function removeModel(data, model) {
        var idx, length;

        for (idx = 0, length = data.length; idx < length; idx++) {
            if (data[idx].uid == model.uid) {
                model = data[idx];
                data.splice(idx, 1);
                return model;
            }
        }
    }

    function wrapInEmptyGroup(groups, model) {
        var parent,
            group,
            idx,
            length;

        for (idx = groups.length-1, length = 0; idx >= length; idx--) {
            group = groups[idx];
            parent = {
                value: model.get(group.field),
                field: group.field,
                items: parent ? [parent] : [model],
                hasSubgroups: !!parent,
                aggregates: {}
            };
        }

        return parent;
    }

    function indexOfPristineModel(data, model) {
        if (model) {
            return indexOf(data, function(item) {
                return item[model.idField] === model.id;
            });
        }
        return -1;
    }

    function indexOfModel(data, model) {
        if (model) {
            return indexOf(data, function(item) {
                return item.uid == model.uid;
            });
        }
        return -1;
    }

    function indexOf(data, comparer) {
        var idx, length;

        for (idx = 0, length = data.length; idx < length; idx++) {
            if (comparer(data[idx])) {
                return idx;
            }
        }

        return -1;
    }

    function fieldNameFromModel(fields, name) {
        if (fields && !isEmptyObject(fields)) {
            var descriptor = fields[name];
            if (isPlainObject(descriptor)) {
                return descriptor.from || descriptor.field || name;
            }
            return fields[name];
        }
        return name;
    }

    function convertFilterDescriptorsField(descriptor, model) {
        var idx,
            length,
            target = {};

        for (var field in descriptor) {
            if (field !== "filters") {
                target[field] = descriptor[field];
            }
        }

        if (descriptor.filters && descriptor.filters.length) {
            target.filters = [];
            for (idx = 0, length = descriptor.filters.length; idx < length; idx++) {
                target.filters[idx] = convertFilterDescriptorsField(descriptor.filters[idx], model);
            }
        } else {
            target.field = fieldNameFromModel(model.fields, target.field);
        }
        return target;
    }

    function convertDescriptorsField(descriptors, model) {
        var idx,
            length,
            result = [],
            target,
            descriptor;

        for (idx = 0, length = descriptors.length; idx < length; idx ++) {
            target = {};

            descriptor = descriptors[idx];

            for (var field in descriptor) {
                target[field] = descriptor[field];
            }

            target.field = fieldNameFromModel(model.fields, target.field);

            if (target.aggregates && isArray(target.aggregates)) {
                target.aggregates = convertDescriptorsField(target.aggregates, model);
            }
            result.push(target);
        }
        return result;
    }

    var DataSource = Observable.extend({
        init: function(options) {
            var that = this, model, data;

            if (options) {
                data = options.data;
            }

            options = that.options = extend({}, that.options, options);

            that._map = {};
            that._prefetch = {};
            that._data = [];
            that._pristineData = [];
            that._ranges = [];
            that._view = [];
            that._pristine = [];
            that._destroyed = [];
            that._pageSize = options.pageSize;
            that._page = options.page  || (options.pageSize ? 1 : undefined);
            that._sort = normalizeSort(options.sort);
            that._filter = normalizeFilter(options.filter);
            that._group = normalizeGroup(options.group);
            that._aggregate = options.aggregate;
            that._total = options.total;

            Observable.fn.init.call(that);

            that.transport = Transport.create(options, data);

            that.reader = new kendo.data.readers[options.schema.type || "json" ](options.schema);

            model = that.reader.model || {};

            that._data = that._observe(that._data);

            that.bind([ERROR, CHANGE, REQUESTSTART, SYNC, REQUESTEND, PROGRESS], options);
        },

        options: {
            data: [],
            schema: {
               modelBase: Model
            },
            serverSorting: false,
            serverPaging: false,
            serverFiltering: false,
            serverGrouping: false,
            serverAggregates: false,
            batch: false
        },

        _isServerGrouped: function() {
            var group = this.group() || [];

            return this.options.serverGrouping && group.length;
        },

        _flatData: function(data) {
            if (this._isServerGrouped()) {
                return flattenGroups(data);
            }
            return data;
        },

        parent: noop,

        get: function(id) {
            var idx, length, data = this._flatData(this._data);

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].id == id) {
                    return data[idx];
                }
            }
        },

        getByUid: function(id) {
            var idx, length, data = this._flatData(this._data);

            if (!data) {
                return;
            }

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].uid == id) {
                    return data[idx];
                }
            }
        },

        indexOf: function(model) {
            return indexOfModel(this._data, model);
        },

        at: function(index) {
            return this._data[index];
        },

        data: function(value) {
            var that = this;
            if (value !== undefined) {
                that._data = this._observe(value);

                that._ranges = [];
                that._addRange(that._data);

                that._total = that._data.length;

                that._process(that._data);
            } else {
                return that._data;
            }
        },

        view: function() {
            return this._view;
        },

        add: function(model) {
            return this.insert(this._data.length, model);
        },

        _createNewModel: function(model) {
            if (this.reader.model) {
                return  new this.reader.model(model);
            }

            return new ObservableObject(model);
        },

        insert: function(index, model) {
            if (!model) {
                model = index;
                index = 0;
            }

            if (!(model instanceof Model)) {
                model = this._createNewModel(model);
            }

            if (this._isServerGrouped()) {
                this._data.splice(index, 0, wrapInEmptyGroup(this.group(), model));
            } else {
                this._data.splice(index, 0, model);
            }

            return model;
        },

        remove: function(model) {
            var result,
                that = this,
                hasGroups = that._isServerGrouped();

            this._eachItem(that._data, function(items) {
                result = removeModel(items, model);
                if (result && hasGroups) {
                    if (!result.isNew || !result.isNew()) {
                        that._destroyed.push(result);
                    }
                    return true;
                }
            });
            return model;
        },

        sync: function() {
            var that = this,
                idx,
                length,
                created = [],
                updated = [],
                destroyed = that._destroyed,
                data = that._flatData(that._data);

            if (!that.reader.model) {
                return;
            }

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].isNew()) {
                    created.push(data[idx]);
                } else if (data[idx].dirty) {
                    updated.push(data[idx]);
                }
            }

            var promises = that._send("create", created);

            promises.push.apply(promises ,that._send("update", updated));
            promises.push.apply(promises ,that._send("destroy", destroyed));

            $.when.apply(null, promises)
                .then(function() {
                    var idx, length;

                    for (idx = 0, length = arguments.length; idx < length; idx++){
                        that._accept(arguments[idx]);
                    }

                    that._change({ action: "sync" });

                    that.trigger(SYNC);
                });
        },

        cancelChanges: function(model) {
            var that = this;

            if (model instanceof kendo.data.Model) {
                that._cancelModel(model);
            } else {
                that._destroyed = [];
                that._data = that._observe(that._pristineData);
                if (that.options.serverPaging) {
                    that._total = that.reader.total(that._pristine);
                }
                that._change();
            }
        },

        hasChanges: function() {
            var idx,
                length,
                data = this._data;

            if (this._destroyed.length) {
                return true;
            }

            for (idx = 0, length = data.length; idx < length; idx++) {
                if (data[idx].isNew() || data[idx].dirty) {
                    return true;
                }
            }

            return false;
        },

        _accept: function(result) {
            var that = this,
                models = result.models,
                response = result.response,
                idx = 0,
                serverGroup = that._isServerGrouped(),
                pristine = that._pristineData,
                type = result.type,
                length;

            that.trigger(REQUESTEND, { response: response, type: type });

            if (response && !isEmptyObject(response)) {
                response = that.reader.parse(response);

                if (that._handleCustomErrors(response)) {
                    return;
                }

                response = that.reader.data(response);

                if (!$.isArray(response)) {
                    response = [response];
                }
            } else {
                response = $.map(models, function(model) { return model.toJSON(); } );
            }

            if (type === "destroy") {
                that._destroyed = [];
            }

            for (idx = 0, length = models.length; idx < length; idx++) {
                if (type !== "destroy") {
                    models[idx].accept(response[idx]);

                    if (type === "create") {
                        pristine.push(serverGroup ? wrapInEmptyGroup(that.group(), models[idx]) : response[idx]);
                    } else if (type === "update") {
                        that._updatePristineForModel(models[idx], response[idx]);
                    }
                } else {
                    that._removePristineForModel(models[idx]);
                }
            }
        },

        _updatePristineForModel: function(model, values) {
            this._executeOnPristineForModel(model, function(index, items) {
                kendo.deepExtend(items[index], values);
            });
        },

        _executeOnPristineForModel: function(model, callback) {
            this._eachPristineItem(
                function(items) {
                    var index = indexOfPristineModel(items, model);
                    if (index > -1) {
                        callback(index, items);
                        return true;
                    }
                });
        },

        _removePristineForModel: function(model) {
            this._executeOnPristineForModel(model, function(index, items) {
                items.splice(index, 1);
            });
        },

        _readData: function(data) {
            var read = !this._isServerGrouped() ? this.reader.data : this.reader.groups;
            return read(data);
        },

        _eachPristineItem: function(callback) {
            this._eachItem(this._pristineData, callback);
        },

       _eachItem: function(data, callback) {
            if (data && data.length) {
                if (this._isServerGrouped()) {
                    eachGroupItems(data, callback);
                } else {
                    callback(data);
                }
            }
        },

        _pristineForModel: function(model) {
            var pristine,
                idx,
                callback = function(items) {
                    idx = indexOfPristineModel(items, model);
                    if (idx > -1) {
                        pristine = items[idx];
                        return true;
                    }
                };

            this._eachPristineItem(callback);

            return pristine;
        },

        _cancelModel: function(model) {
            var pristine = this._pristineForModel(model),
                idx;

           this._eachItem(this._data, function(items) {
                idx = indexOfModel(items, model);
                if (idx != -1) {
                    if (!model.isNew() && pristine) {
                        items[idx].accept(pristine);
                    } else {
                        items.splice(idx, 1);
                    }
                }
            });
        },

        _promise: function(data, models, type) {
            var that = this,
            transport = that.transport;

            return $.Deferred(function(deferred) {

                that.trigger(REQUESTSTART);

                transport[type].call(transport, extend({
                    success: function(response) {
                        deferred.resolve({
                            response: response,
                            models: models,
                            type: type
                        });
                    },
                    error: function(response, status, error) {
                        deferred.reject(response);
                        that.error(response, status, error);
                    }
                }, data)
                );
            }).promise();
        },

        _send: function(method, data) {
            var that = this,
                idx,
                length,
                promises = [],
                converted = that.reader.serialize(toJSON(data));

            if (that.options.batch) {
                if (data.length) {
                    promises.push(that._promise( { data: { models: converted } }, data , method));
                }
            } else {
                for (idx = 0, length = data.length; idx < length; idx++) {
                    promises.push(that._promise( { data: converted[idx] }, [ data[idx] ], method));
                }
            }

            return promises;
        },

        read: function(data) {
            var that = this, params = that._params(data);

            that._queueRequest(params, function() {
                if (!that.trigger(REQUESTSTART)) {
                    that.trigger(PROGRESS);

                    that._ranges = [];
                    that.transport.read({
                        data: params,
                        success: proxy(that.success, that),
                        error: proxy(that.error, that)
                    });
                } else {
                    that._dequeueRequest();
                }
            });
        },

        success: function(data) {
            var that = this,
                options = that.options;

            that.trigger(REQUESTEND, { response: data, type: "read" });

            data = that.reader.parse(data);

            if (that._handleCustomErrors(data)) {
                that._dequeueRequest();
                return;
            }

            that._pristine = isPlainObject(data) ? $.extend(true, {}, data) : data.slice ? data.slice(0) : data;

            that._total = that.reader.total(data);

            if (that._aggregate && options.serverAggregates) {
                that._aggregateResult = that.reader.aggregates(data);
            }

            data = that._readData(data);

            that._pristineData = data.slice(0);

            that._data = that._observe(data);

            that._addRange(that._data);

            that._process(that._data);
            that._dequeueRequest();
        },

        _addRange: function(data) {
            var that = this,
                start = that._skip || 0,
                end = start + that._flatData(data).length;

            that._ranges.push({ start: start, end: end, data: data });
            that._ranges.sort( function(x, y) { return x.start - y.start; } );
        },

        error: function(xhr, status, errorThrown) {
            this._dequeueRequest();
            this.trigger(REQUESTEND, { });
            this.trigger(ERROR, { xhr: xhr, status: status, errorThrown: errorThrown });
        },

        _params: function(data) {
            var that = this,
                options =  extend({
                    take: that.take(),
                    skip: that.skip(),
                    page: that.page(),
                    pageSize: that.pageSize(),
                    sort: that._sort,
                    filter: that._filter,
                    group: that._group,
                    aggregate: that._aggregate
                }, data);

            if (!that.options.serverPaging) {
                delete options.take;
                delete options.skip;
                delete options.page;
                delete options.pageSize;
            }

            if (!that.options.serverGrouping) {
                delete options.group;
            } else if (that.reader.model && options.group) {
                options.group = convertDescriptorsField(options.group, that.reader.model);
            }

            if (!that.options.serverFiltering) {
                delete options.filter;
            } else if (that.reader.model && options.filter) {
               options.filter = convertFilterDescriptorsField(options.filter, that.reader.model);
            }

            if (!that.options.serverSorting) {
                delete options.sort;
            } else if (that.reader.model && options.sort) {
                options.sort = convertDescriptorsField(options.sort, that.reader.model);
            }

            if (!that.options.serverAggregates) {
                delete options.aggregate;
            } else if (that.reader.model && options.aggregate) {
                options.aggregate = convertDescriptorsField(options.aggregate, that.reader.model);
            }

            return options;
        },

        _queueRequest: function(options, callback) {
            var that = this;
            if (!that._requestInProgress) {
                that._requestInProgress = true;
                that._pending = undefined;
                callback();
            } else {
                that._pending = { callback: proxy(callback, that), options: options };
            }
        },

        _dequeueRequest: function() {
            var that = this;
            that._requestInProgress = false;
            if (that._pending) {
                that._queueRequest(that._pending.options, that._pending.callback);
            }
        },

        _handleCustomErrors: function(response) {
            if (this.reader.errors) {
                var errors = this.reader.errors(response);
                if (errors) {
                    this.trigger(ERROR, { xhr: null, status: "customerror", errorThrown: "custom error", errors: errors });
                    return true;
                }
            }
            return false;
        },
        _observe: function(data) {
            var that = this,
                model = that.reader.model,
                wrap = false;

            if (model && data.length) {
                wrap = !(data[0] instanceof model);
            }

            if (data instanceof ObservableArray) {
                if (wrap) {
                    data.type = that.reader.model;
                    data.wrapAll(data, data);
                }
            } else {
                data = new ObservableArray(data, that.reader.model);
                data.parent = function() { return that.parent(); };
            }

            if (that._isServerGrouped()) {
                wrapGroupItems(data, model);
            }

            if (that._changeHandler && that._data && that._data instanceof ObservableArray) {
                that._data.unbind(CHANGE, that._changeHandler);
            } else {
                that._changeHandler = proxy(that._change, that);
            }

            return data.bind(CHANGE, that._changeHandler);
        },

        _change: function(e) {
            var that = this, idx, length, action = e ? e.action : "";

            if (action === "remove") {
                for (idx = 0, length = e.items.length; idx < length; idx++) {
                    if (!e.items[idx].isNew || !e.items[idx].isNew()) {
                        that._destroyed.push(e.items[idx]);
                    }
                }
            }

            if (that.options.autoSync && (action === "add" || action === "remove" || action === "itemchange")) {
                that.sync();
            } else {
                var total = that._total || that.reader.total(that._pristine);
                if (action === "add") {
                    total += e.items.length;
                } else if (action === "remove") {
                    total -= e.items.length;
                } else if (action !== "itemchange" && action !== "sync" && !that.options.serverPaging) {
                    total = that.reader.total(that._pristine);
                }

                that._total = total;

                that._process(that._data, e);
            }
        },

        _process: function (data, e) {
            var that = this,
                options = {},
                result;

            if (that.options.serverPaging !== true) {
                options.skip = that._skip;
                options.take = that._take || that._pageSize;

                if(options.skip === undefined && that._page !== undefined && that._pageSize !== undefined) {
                    options.skip = (that._page - 1) * that._pageSize;
                }
            }

            if (that.options.serverSorting !== true) {
                options.sort = that._sort;
            }

            if (that.options.serverFiltering !== true) {
                options.filter = that._filter;
            }

            if (that.options.serverGrouping !== true) {
                options.group = that._group;
            }

            if (that.options.serverAggregates !== true) {
                options.aggregate = that._aggregate;
                that._aggregateResult = calculateAggregates(data, options);
            }

            result = Query.process(data, options);

            that._view = result.data;

            if (result.total !== undefined && !that.options.serverFiltering) {
                that._total = result.total;
            }

            e = e || {};

            e.items = e.items || that._view;

            that.trigger(CHANGE, e);
        },

        _mergeState: function(options) {
            var that = this;

            if (options !== undefined) {
                that._pageSize = options.pageSize;
                that._page = options.page;
                that._sort = options.sort;
                that._filter = options.filter;
                that._group = options.group;
                that._aggregate = options.aggregate;
                that._skip = options.skip;
                that._take = options.take;

                if(that._skip === undefined) {
                    that._skip = that.skip();
                    options.skip = that.skip();
                }

                if(that._take === undefined && that._pageSize !== undefined) {
                    that._take = that._pageSize;
                    options.take = that._take;
                }

                if (options.sort) {
                    that._sort = options.sort = normalizeSort(options.sort);
                }

                if (options.filter) {
                    that._filter = options.filter = normalizeFilter(options.filter);
                }

                if (options.group) {
                    that._group = options.group = normalizeGroup(options.group);
                }
                if (options.aggregate) {
                    that._aggregate = options.aggregate = normalizeAggregate(options.aggregate);
                }
            }
            return options;
        },

        query: function(options) {
            var that = this,
                result,
                remote = that.options.serverSorting || that.options.serverPaging || that.options.serverFiltering || that.options.serverGrouping || that.options.serverAggregates;

            if (remote || ((that._data === undefined || that._data.length === 0) && !that._destroyed.length)) {
                that.read(that._mergeState(options));
            } else {
                if (!that.trigger(REQUESTSTART)) {
                    that.trigger(PROGRESS);

                    result = Query.process(that._data, that._mergeState(options));

                    if (!that.options.serverFiltering) {
                        if (result.total !== undefined) {
                            that._total = result.total;
                        } else {
                            that._total = that._data.length;
                        }
                    }

                    that._view = result.data;
                    that._aggregateResult = calculateAggregates(that._data, options);
                    that.trigger(REQUESTEND, { });
                    that.trigger(CHANGE, { items: result.data });
                }
            }
        },

        fetch: function(callback) {
            var that = this;

            return $.Deferred(function(deferred) {
                var success = function(e) {
                    that.unbind(ERROR, error);

                    deferred.resolve();

                    if (callback) {
                        callback.call(that, e);
                    }
                };

                var error = function(e) {
                    deferred.reject(e);
                };

                that.one(CHANGE, success);
                that.one(ERROR, error);
                that._query();
            }).promise();
        },

        _query: function(options) {
            var that = this;

            that.query(extend({}, {
                page: that.page(),
                pageSize: that.pageSize(),
                sort: that.sort(),
                filter: that.filter(),
                group: that.group(),
                aggregate: that.aggregate()
            }, options));
        },

        next: function(options) {
            var that = this,
                page = that.page(),
                total = that.total();

            options = options || {};

            if (!page || (total && page + 1 > that.totalPages())) {
                return;
            }

            that._skip = page * that.take();

            page += 1;
            options.page = page;

            that._query(options);

            return page;
        },

        prev: function(options) {
            var that = this,
                page = that.page();

            options = options || {};

            if (!page || page === 1) {
                return;
            }

            that._skip = that._skip - that.take();

            page -= 1;
            options.page = page;

            that._query(options);

            return page;
        },

        page: function(val) {
            var that = this,
            skip;

            if(val !== undefined) {
                val = math.max(math.min(math.max(val, 1), that.totalPages()), 1);
                that._query({ page: val });
                return;
            }
            skip = that.skip();

            return skip !== undefined ? math.round((skip || 0) / (that.take() || 1)) + 1 : undefined;
        },

        pageSize: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ pageSize: val, page: 1 });
                return;
            }

            return that.take();
        },

        sort: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ sort: val });
                return;
            }

            return that._sort;
        },

        filter: function(val) {
            var that = this;

            if (val === undefined) {
                return that._filter;
            }

            that._query({ filter: val, page: 1 });
        },

        group: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ group: val });
                return;
            }

            return that._group;
        },

        total: function() {
            return this._total || 0;
        },

        aggregate: function(val) {
            var that = this;

            if(val !== undefined) {
                that._query({ aggregate: val });
                return;
            }

            return that._aggregate;
        },

        aggregates: function() {
            return this._aggregateResult;
        },

        totalPages: function() {
            var that = this,
            pageSize = that.pageSize() || that.total();

            return math.ceil((that.total() || 0) / pageSize);
        },

        inRange: function(skip, take) {
            var that = this,
            end = math.min(skip + take, that.total());

            if (!that.options.serverPaging && that.data.length > 0) {
                return true;
            }

            return that._findRange(skip, end).length > 0;
        },

        lastRange: function() {
            var ranges = this._ranges;
            return ranges[ranges.length - 1] || { start: 0, end: 0, data: [] };
        },

        firstItemUid: function() {
            var ranges = this._ranges;
            return ranges.length && ranges[0].data.length && ranges[0].data[0].uid;
        },

        range: function(skip, take) {
            skip = math.min(skip || 0, this.total());
            var that = this,
            pageSkip = math.max(math.floor(skip / take), 0) * take,
            size = math.min(pageSkip + take, that.total()),
            data;

            data = that._findRange(skip, math.min(skip + take, that.total()));

            if (data.length) {
                that._skip = skip > that.skip() ? math.min(size, (that.totalPages() - 1) * that.take()) : pageSkip;

                that._take = take;

                var paging = that.options.serverPaging;
                var sorting = that.options.serverSorting;
                var filtering = that.options.serverFiltering;
                try {
                    that.options.serverPaging = true;
                    that.options.serverSorting = true;
                    that.options.serverFiltering = true;
                    if (paging) {
                        that._data = data = that._observe(data);
                    }
                    that._process(data);
                } finally {
                    that.options.serverPaging = paging;
                    that.options.serverSorting = sorting;
                    that.options.serverFiltering = filtering;
                }

                return;
            }

            if (take !== undefined) {
                if (!that._rangeExists(pageSkip, size)) {
                    that.prefetch(pageSkip, take, function() {
                        if (skip > pageSkip && size < that.total() && !that._rangeExists(size, math.min(size + take, that.total()))) {
                            that.prefetch(size, take, function() {
                                that.range(skip, take);
                            });
                        } else {
                            that.range(skip, take);
                        }
                    });
                } else if (pageSkip < skip) {
                    that.prefetch(size, take, function() {
                        that.range(skip, take);
                    });
                }
            }
        },

        _findRange: function(start, end) {
            var that = this,
                ranges = that._ranges,
                range,
                data = [],
                skipIdx,
                takeIdx,
                startIndex,
                endIndex,
                rangeData,
                rangeEnd,
                processed,
                options = that.options,
                remote = options.serverSorting || options.serverPaging || options.serverFiltering || options.serverGrouping || options.serverAggregates,
                flatData,
                count,
                length;

            for (skipIdx = 0, length = ranges.length; skipIdx < length; skipIdx++) {
                range = ranges[skipIdx];
                if (start >= range.start && start <= range.end) {
                    count = 0;

                    for (takeIdx = skipIdx; takeIdx < length; takeIdx++) {
                        range = ranges[takeIdx];
                        flatData = that._flatData(range.data);

                        if (flatData.length && start + count >= range.start) {
                            rangeData = range.data;
                            rangeEnd = range.end;

                            if (!remote) {
                                var sort = normalizeGroup(that.group() || []).concat(normalizeSort(that.sort() || []));
                                processed = Query.process(range.data, { sort: sort, filter: that.filter() });
                                flatData = rangeData = processed.data;

                                if (processed.total !== undefined) {
                                    rangeEnd = processed.total;
                                }
                            }

                            startIndex = 0;
                            if (start + count > range.start) {
                                startIndex = (start + count) - range.start;
                            }
                            endIndex = flatData.length;
                            if (rangeEnd > end) {
                                endIndex = endIndex - (rangeEnd - end);
                            }
                            count += endIndex - startIndex;
                            data = that._mergeGroups(data, rangeData, startIndex, endIndex);

                            if (end <= range.end && count == end - start) {
                                return data;
                            }
                        }
                    }
                    break;
                }
            }
            return [];
        },

        _mergeGroups: function(data, range, startIndex, endIndex) {
            if (this._isServerGrouped()) {
                var temp = range.toJSON(),
                    prevGroup;

                if (data.length) {
                    prevGroup = data[data.length - 1];
                }

                mergeGroups(prevGroup, temp, startIndex, endIndex);

                return data.concat(temp);
            }
            return data.concat(range.slice(startIndex, endIndex));
        },

        skip: function() {
            var that = this;

            if (that._skip === undefined) {
                return (that._page !== undefined ? (that._page  - 1) * (that.take() || 1) : undefined);
            }
            return that._skip;
        },

        take: function() {
            return this._take || this._pageSize;
        },

        _prefetchSuccessHandler: function (skip, size, callback) {
            var that = this;
            return function(data) {
                var found = false,
                    range = { start: skip, end: size, data: [] },
                    idx,
                    length;

                that._dequeueRequest();

                for (idx = 0, length = that._ranges.length; idx < length; idx++) {
                    if (that._ranges[idx].start === skip) {
                        found = true;
                        range = that._ranges[idx];
                        break;
                    }
                }
                if (!found) {
                    that._ranges.push(range);
                }


                that.trigger(REQUESTEND, { response: data, type: "read" });

                data = that.reader.parse(data);
                range.data = that._observe(that._readData(data));
                range.end = range.start + that._flatData(range.data).length;
                that._ranges.sort( function(x, y) { return x.start - y.start; } );
                that._total = that.reader.total(data);
                if (callback) {
                    callback();
                }
            };
        },

        prefetch: function(skip, take, callback) {
            var that = this,
                size = math.min(skip + take, that.total()),
                options = {
                    take: take,
                    skip: skip,
                    page: skip / take + 1,
                    pageSize: take,
                    sort: that._sort,
                    filter: that._filter,
                    group: that._group,
                    aggregate: that._aggregate
                };

            if (!that._rangeExists(skip, size)) {
                clearTimeout(that._timeout);

                that._timeout = setTimeout(function() {
                    that._queueRequest(options, function() {
                        if (!that.trigger(REQUESTSTART)) {
                            that.transport.read({
                                data: options,
                                success: that._prefetchSuccessHandler(skip, size, callback)
                            });
                        } else {
                            that._dequeueRequest();
                        }
                    });
                }, 100);
            } else if (callback) {
                callback();
            }
        },

        _rangeExists: function(start, end) {
            var that = this,
            ranges = that._ranges,
            idx,
            length;

            for (idx = 0, length = ranges.length; idx < length; idx++) {
                if (ranges[idx].start <= start && ranges[idx].end >= end) {
                    return true;
                }
            }
            return false;
        }
    });

    var Transport = {};

    Transport.create = function(options, data) {
        var transport,
            transportOptions = options.transport;

        if (transportOptions) {
            transportOptions.read = typeof transportOptions.read === STRING ? { url: transportOptions.read } : transportOptions.read;

            if (options.type) {
                if (kendo.data.transports[options.type] && !isPlainObject(kendo.data.transports[options.type])) {
                    transport = new kendo.data.transports[options.type](extend(transportOptions, { data: data }));
                } else {
                    transportOptions = extend(true, {}, kendo.data.transports[options.type], transportOptions);
                }

                options.schema = extend(true, {}, kendo.data.schemas[options.type], options.schema);
            }

            if (!transport) {
                transport = isFunction(transportOptions.read) ? transportOptions : new RemoteTransport(transportOptions);
            }
        } else {
            transport = new LocalTransport({ data: options.data });
        }
        return transport;
    };

    DataSource.create = function(options) {
        options = options && options.push ? { data: options } : options;

        var dataSource = options || {},
        data = dataSource.data,
        fields = dataSource.fields,
        table = dataSource.table,
        select = dataSource.select,
        idx,
        length,
        model = {},
        field;

        if (!data && fields && !dataSource.transport) {
            if (table) {
                data = inferTable(table, fields);
            } else if (select) {
                data = inferSelect(select, fields);
            }
        }

        if (kendo.data.Model && fields && (!dataSource.schema || !dataSource.schema.model)) {
            for (idx = 0, length = fields.length; idx < length; idx++) {
                field = fields[idx];
                if (field.type) {
                    model[field.field] = field;
                }
            }

            if (!isEmptyObject(model)) {
                dataSource.schema = extend(true, dataSource.schema, { model:  { fields: model } });
            }
        }

        dataSource.data = data;

        return dataSource instanceof DataSource ? dataSource : new DataSource(dataSource);
    };

    function inferSelect(select, fields) {
        var options = $(select)[0].children,
            idx,
            length,
            data = [],
            record,
            firstField = fields[0],
            secondField = fields[1],
            value,
            option;

        for (idx = 0, length = options.length; idx < length; idx++) {
            record = {};
            option = options[idx];

            if (option.disabled) {
                continue;
            }

            record[firstField.field] = option.text;

            value = option.attributes.value;

            if (value && value.specified) {
                value = option.value;
            } else {
                value = option.text;
            }

            record[secondField.field] = value;

            data.push(record);
        }

        return data;
    }

    function inferTable(table, fields) {
        var tbody = $(table)[0].tBodies[0],
        rows = tbody ? tbody.rows : [],
        idx,
        length,
        fieldIndex,
        fieldCount = fields.length,
        data = [],
        cells,
        record,
        cell,
        empty;

        for (idx = 0, length = rows.length; idx < length; idx++) {
            record = {};
            empty = true;
            cells = rows[idx].cells;

            for (fieldIndex = 0; fieldIndex < fieldCount; fieldIndex++) {
                cell = cells[fieldIndex];
                if(cell.nodeName.toLowerCase() !== "th") {
                    empty = false;
                    record[fields[fieldIndex].field] = cell.innerHTML;
                }
            }
            if(!empty) {
                data.push(record);
            }
        }

        return data;
    }

    var Node = Model.define({
        init: function(value) {
            var that = this,
                hasChildren = that.hasChildren || value && value.hasChildren,
                childrenField = "items",
                childrenOptions = {};

            kendo.data.Model.fn.init.call(that, value);

            if (typeof that.children === STRING) {
                childrenField = that.children;
            }

            childrenOptions = {
                schema: {
                    data: childrenField,
                    model: {
                        hasChildren: hasChildren,
                        id: that.idField
                    }
                }
            };

            if (typeof that.children !== STRING) {
                extend(childrenOptions, that.children);
            }

            var transport = childrenOptions.transport;

            if (transport) {
                transport.parameterMap = function(data) {
                    if (that.parentParameterMap) {
                        data = that.parentParameterMap.call(this, data);
                    }

                    data[that.idField || "id"] = that.id;
                    return data;
                };
            }

            childrenOptions.data = value;

            if (!hasChildren) {
                hasChildren = childrenOptions.schema.data;
            }

            if (typeof hasChildren === STRING) {
                hasChildren = kendo.getter(hasChildren);
            }

            if (isFunction(hasChildren)) {
                that.hasChildren = !!hasChildren.call(that, that);
            }

            that._childrenOptions = childrenOptions;

            if (that.hasChildren) {
                that._initChildren();
            }

            that._loaded = !!(value && (value[childrenField] || value._loaded));
        },

        _initChildren: function() {
            var that = this;

            if (!(that.children instanceof HierarchicalDataSource)) {
                that.children = new HierarchicalDataSource(that._childrenOptions);
                that.children.parent = function(){
                    return that;
                };

                that.children.bind(CHANGE, function(e){
                    e.node = e.node || that;
                    that.trigger(CHANGE, e);
                });

                that.children.bind(ERROR, function(e){
                    var collection = that.parent();

                    if (collection) {
                        e.node = e.node || that;
                        collection.trigger(ERROR, e);
                    }
                });

                that._updateChildrenField();
            }
        },

        append: function(model) {
            this._initChildren();
            this.loaded(true);
            this.children.add(model);
        },

        hasChildren: false,

        level: function() {
            var parentNode = this.parentNode(),
                level = 0;

            while (parentNode && parentNode.parentNode) {
                level++;
                parentNode = parentNode.parentNode ? parentNode.parentNode() : null;
            }

            return level;
        },

        _updateChildrenField: function() {
            var fieldName = this._childrenOptions.schema.data;

            this[fieldName || "items"] = this.children.data();
        },

        load: function() {
            var that = this,
                options = {};

            if (that.hasChildren) {
                that._initChildren();

                options[that.idField || "id"] = that.id;

                if (!that._loaded) {
                    that.children._data = undefined;
                }

                that.children.one(CHANGE, function() {
                            that._loaded = true;

                            that._updateChildrenField();
                        })
                        ._query(options);
            }
        },

        parentNode: function() {
            var array = this.parent();

            return array.parent();
        },

        loaded: function(value) {
            if (value !== undefined) {
                this._loaded = value;
            } else {
                return this._loaded;
            }
        },

        shouldSerialize: function(field) {
            return Model.fn.shouldSerialize.call(this, field) &&
                    field !== "children" &&
                    field !== "_loaded" &&
                    field !== "hasChildren" &&
                    field !== "_childrenOptions";
        }
    });

    function dataMethod(name) {
        return function() {
            var data = this._data,
                result = DataSource.fn[name].apply(this, slice.call(arguments));

            if (this._data != data) {
                this._attachBubbleHandlers();
            }

            return result;
        };
    }

    var HierarchicalDataSource = DataSource.extend({
        init: function(options) {
            var node = Node.define({
                children: options
            });

            DataSource.fn.init.call(this, extend(true, {}, { schema: { modelBase: node, model: node } }, options));

            if (this.transport) {
                node.fn.parentParameterMap = this.transport.parameterMap;
            }

            this._attachBubbleHandlers();
        },

        _attachBubbleHandlers: function() {
            var that = this;

            that._data.bind(ERROR, function(e) {
                that.trigger(ERROR, e);
            });
        },

        remove: function(node){
            var parentNode = node.parentNode(),
                dataSource = this,
                result;

            if (parentNode && parentNode._initChildren) {
                dataSource = parentNode.children;
            }

            result = DataSource.fn.remove.call(dataSource, node);

            if (parentNode && !dataSource.data().length) {
                parentNode.hasChildren = false;
            }

            return result;
        },

        success: dataMethod("success"),

        data: dataMethod("data"),

        insert: function(index, model) {
            var parentNode = this.parent();

            if (parentNode && parentNode._initChildren) {
                parentNode.hasChildren = true;
                parentNode._initChildren();
            }

            return DataSource.fn.insert.call(this, index, model);
        },

        _find: function(method, value) {
            var idx, length, node, data, children;

            node = DataSource.fn[method].call(this, value);

            if (node) {
                return node;
            }

            data = this._flatData(this.data());

            if (!data) {
                return;
            }

            for (idx = 0, length = data.length; idx < length; idx++) {
                children = data[idx].children;

                if (!(children instanceof HierarchicalDataSource)) {
                    continue;
                }

                node = children[method](value);

                if (node) {
                    return node;
                }
            }
        },

        get: function(id) {
            return this._find("get", id);
        },

        getByUid: function(uid) {
            return this._find("getByUid", uid);
        }
    });

    function inferList(list, fields) {
        var items = $(list).children(),
            idx,
            length,
            data = [],
            record,
            textField = fields[0].field,
            urlField = fields[1] && fields[1].field,
            spriteCssClassField = fields[2] && fields[2].field,
            imageUrlField = fields[3] && fields[3].field,
            item,
            id,
            textChild,
            className,
            children;

        for (idx = 0, length = items.length; idx < length; idx++) {
            record = { _loaded: true };
            item = items.eq(idx);

            textChild = item[0].firstChild;
            children = item.children();
            list = children.filter("ul");
            children = children.filter(":not(ul)");

            id = item.attr("data-id");

            if (id) {
                record.id = id;
            }

            if (textChild) {
                record[textField] = textChild.nodeType == 3 ? textChild.nodeValue : children.text();
            }

            if (urlField) {
                record[urlField] = children.find("a").attr("href");
            }

            if (imageUrlField) {
                record[imageUrlField] = children.find("img").attr("src");
            }

            if (spriteCssClassField) {
                className = children.find(".k-sprite").prop("className");
                record[spriteCssClassField] = className && $.trim(className.replace("k-sprite", ""));
            }

            if (list.length) {
                record.items = inferList(list.eq(0), fields);
            }

            if (item.attr("data-hasChildren") == "true") {
                record.hasChildren = true;
            }

            data.push(record);
        }

        return data;
    }

    HierarchicalDataSource.create = function(options) {
        options = options && options.push ? { data: options } : options;

        var dataSource = options || {},
            data = dataSource.data,
            fields = dataSource.fields,
            list = dataSource.list;

        if (data && data._dataSource) {
            return data._dataSource;
        }

        if (!data && fields && !dataSource.transport) {
            if (list) {
                data = inferList(list, fields);
            }
        }

        dataSource.data = data;

        return dataSource instanceof HierarchicalDataSource ? dataSource : new HierarchicalDataSource(dataSource);
    };

    var Buffer = kendo.Observable.extend({
        init: function(dataSource, viewSize, disablePrefetch) {
            kendo.Observable.fn.init.call(this);

            this._prefetching = false;
            this.dataSource = dataSource;
            this.prefetch = !disablePrefetch;

            var buffer = this;

            dataSource.bind("change", function() {
                buffer._change();
            });

            this._syncWithDataSource();

            this.setViewSize(viewSize);
        },

        setViewSize: function(viewSize) {
            this.viewSize = viewSize;
            this._recalculate();
        },

        at: function(index)  {
            var pageSize = this.pageSize;

            if (index >= this.total()) {
                this.trigger("endreached", {index: index });
                return;
            }

            // out of range request
            if (index < this.dataOffset || index > this.skip + pageSize) {
                var offset = Math.floor(index / pageSize) * pageSize;
                this.range(offset);
            }

            // prefetch
            if (index === this.prefetchThreshold) {
                this._prefetch();
            }

            // mid-range jump - prefetchThreshold and nextPageThreshold may be equal, do not change to else if
            if (index === this.midPageThreshold) {
                this.range(this.nextMidRange);
            }
            // next range jump
            else if (index === this.nextPageThreshold) {
                this.range(this.nextFullRange);
            }
            // pull-back
            else if (index === this.pullBackThreshold) {
                if (this.offset === this.skip) { // from full range to mid range
                    this.range(this.previousMidRange);
                } else { // from mid range to full range
                    this.range(this.previousFullRange);
                }
            }

            var item = this.dataSource.at(index - this.dataOffset);

            if (item === undefined) {
                this.trigger("endreached", { index: index });
            }

            return item;
        },

        indexOf: function(item) {
            return this.dataSource.data().indexOf(item) + this.dataOffset;
        },

        _prefetch: function() {
            var buffer = this,
                pageSize = this.pageSize,
                prefetchOffset = this.skip + pageSize,
                dataSource = this.dataSource;

            if (!dataSource.inRange(prefetchOffset, pageSize) && !this._prefetching && this.prefetch) {
                this._prefetching = true;
                this.trigger("prefetching", { skip: prefetchOffset, take: pageSize });

                dataSource.prefetch(prefetchOffset, pageSize, function() {
                    buffer._prefetching = false;
                    buffer.trigger("prefetched", { skip: prefetchOffset, take: pageSize });
                });
            }
        },

        total: function() {
            return parseInt(this.dataSource.total(), 10);
        },

        next: function() {
            var buffer = this,
                pageSize = buffer.pageSize,
                offset = buffer.skip - buffer.viewSize, // this calculation relies that the buffer has already jumped into the mid range segment
                pageSkip = math.max(math.floor(offset / pageSize), 0) * pageSize + pageSize;

            this.offset = offset;
            this.dataSource.prefetch(pageSkip, pageSize, function() {
                buffer._goToRange(offset, true);
            });
        },

        range: function(offset) {
            if (this.offset === offset) {
                return;
            }

            var buffer = this,
                pageSize = this.pageSize,
                pageSkip = math.max(math.floor(offset / pageSize), 0) * pageSize + pageSize,
                dataSource = this.dataSource;

            this.offset = offset;
            this._recalculate();
            if (dataSource.inRange(offset, pageSize)) {
                this._goToRange(offset);
            } else if (this.prefetch) {
                dataSource.prefetch(pageSkip, pageSize, function() {
                    buffer._goToRange(offset, true);
                });
            }
        },

        syncDataSource: function() {
            var offset = this.offset;
            this.offset = null;
            this.range(offset);
        },

        _goToRange: function(offset, expanding) {
            if (this.offset !== offset) {
                return;
            }

            this.dataOffset = offset;
            this._expanding = expanding;
            this.dataSource.range(offset, this.pageSize);
        },

        _change: function() {
            var dataSource = this.dataSource,
                firstItemUid = dataSource.firstItemUid();

            this.length = dataSource.lastRange().end;

            if (this._firstItemUid !== firstItemUid) {
                this._syncWithDataSource();
                this._recalculate();
                this.trigger("reset", { offset: this.offset });
            }

            this.trigger("resize");

            if (this._expanding) {
                this.trigger("expand");
            }

            delete this._expanding;
        },

        _syncWithDataSource: function() {
            var dataSource = this.dataSource;

            this._firstItemUid = dataSource.firstItemUid();
            this.dataOffset = this.offset = dataSource.skip();
            this.pageSize = dataSource.pageSize();
        },

        _recalculate: function() {
            var pageSize = this.pageSize,
                offset = this.offset,
                viewSize = this.viewSize,
                skip = Math.ceil(offset / pageSize) * pageSize;

            this.skip = skip;
            this.midPageThreshold = skip + pageSize - 1;
            this.nextPageThreshold = skip + viewSize - 1;
            this.prefetchThreshold = skip + Math.floor(pageSize / 3 * 2);
            this.pullBackThreshold = this.offset - 1;

            this.nextMidRange = skip + pageSize - viewSize;
            this.nextFullRange = skip;
            this.previousMidRange = offset - viewSize;
            this.previousFullRange = skip - pageSize;
        }
    });

    var BatchBuffer = kendo.Observable.extend({
        init: function(dataSource, batchSize) {
            var batchBuffer = this;

            kendo.Observable.fn.init.call(batchBuffer);

            this.dataSource = dataSource;
            this.batchSize = batchSize;
            this._total = 0;

            this.buffer = new Buffer(dataSource, batchSize * 3);

            this.buffer.bind({
                "endreached": function (e) {
                    batchBuffer.trigger("endreached", { index: e.index });
                },
                "prefetching": function (e) {
                    batchBuffer.trigger("prefetching", { skip: e.skip, take: e.take });
                },
                "prefetched": function (e) {
                    batchBuffer.trigger("prefetched", { skip: e.skip, take: e.take });
                },
                "reset": function () {
                    batchBuffer._total = 0;
                    batchBuffer.trigger("reset");
                },
                "resize": function () {
                    batchBuffer._total = this.length / batchBuffer.batchSize;
                    batchBuffer.trigger("resize", { total: batchBuffer.total(), offset: this.offset });
                }
            });
        },

        syncDataSource: function() {
            this.buffer.syncDataSource();
        },

        at: function(index) {
            var buffer = this.buffer,
                skip = index * this.batchSize,
                take = this.batchSize,
                view = [],
                item;

            if (buffer.offset > skip) {
                buffer.at(buffer.offset - 1);
            }

            for (var i = 0; i < take; i++) {
                item = buffer.at(skip + i);

                if (item === undefined) {
                    return;
                }

                view.push(item);
            }

            return view;
        },

        total: function() {
            return this._total;
        }
    });

    extend(true, kendo.data, {
        readers: {
            json: DataReader
        },
        Query: Query,
        DataSource: DataSource,
        HierarchicalDataSource: HierarchicalDataSource,
        Node: Node,
        ObservableObject: ObservableObject,
        ObservableArray: ObservableArray,
        LocalTransport: LocalTransport,
        RemoteTransport: RemoteTransport,
        Cache: Cache,
        DataReader: DataReader,
        Model: Model,
        Buffer: Buffer,
        BatchBuffer: BatchBuffer
    });
})(window.kendo.jQuery);

/*
* Kendo UI Beta v2013.2.716 (http://kendoui.com)
* Copyright 2013 Telerik AD. All rights reserved.
*
* Kendo UI Beta license terms available at
* http://www.kendoui.com/purchase/license-agreement/kendo-ui-beta.aspx
*/

kendo_module({
    id: "binder",
    name: "MVVM",
    category: "framework",
    description: "Model View ViewModel (MVVM) is a design pattern which helps developers separate the Model (the data) from the View (the UI).",
    depends: [ "core", "data" ]
});

(function ($, undefined) {
    var kendo = window.kendo,
        Observable = kendo.Observable,
        ObservableObject = kendo.data.ObservableObject,
        ObservableArray = kendo.data.ObservableArray,
        toString = {}.toString,
        binders = {},
        Class = kendo.Class,
        innerText,
        proxy = $.proxy,
        VALUE = "value",
        SOURCE = "source",
        EVENTS = "events",
        CHECKED = "checked",
        CHANGE = "change";

    (function() {
        var a = document.createElement("a");
        if (a.innerText !== undefined) {
            innerText = "innerText";
        } else if (a.textContent !== undefined) {
            innerText = "textContent";
        }
    })();

    var Binding = Observable.extend( {
        init: function(parents, path) {
            var that = this;

            Observable.fn.init.call(that);

            that.source = parents[0];
            that.parents = parents;
            that.path = path;
            that.dependencies = {};
            that.dependencies[path] = true;
            that.observable = that.source instanceof Observable;

            that._access = function(e) {
                that.dependencies[e.field] = true;
            };

            if (that.observable) {
                that._change = function(e) {
                    that.change(e);
                };

                that.source.bind(CHANGE, that._change);
            }
        },

        _parents: function() {
            var parents = this.parents;
            var value = this.get();

            if (value && typeof value.parent == "function") {
                var parent = value.parent();

                if ($.inArray(parent, parents) < 0) {
                    parents = [parent].concat(parents);
                }
            }

            return parents;
        },

        change: function(e) {
            var dependency,
                ch,
                field = e.field,
                that = this;

            if (that.path === "this") {
                that.trigger(CHANGE, e);
            } else {
                for (dependency in that.dependencies) {
                    if (dependency.indexOf(field) === 0) {
                       ch = dependency.charAt(field.length);

                       if (!ch || ch === "." || ch === "[") {
                            that.trigger(CHANGE, e);
                            break;
                       }
                    }
                }
            }
        },

        start: function(source) {
            source.bind("get", this._access);
        },

        stop: function(source) {
            source.unbind("get", this._access);
        },

        get: function() {

            var that = this,
                source = that.source,
                index = 0,
                path = that.path,
                result = source;

            if (!that.observable) {
                return result;
            }

            that.start(that.source);

            result = source.get(path);

            // Traverse the observable hierarchy if the binding is not resolved at the current level.
            while (result === undefined && source) {

                source = that.parents[++index];

                if (source instanceof ObservableObject) {
                    result = source.get(path);
                }
            }

            // second pass try to get the parent from the object hierarchy
            if (result === undefined) {
                source = that.source; //get the initial source

                while (result === undefined && source) {
                    source = source.parent();

                    if (source instanceof ObservableObject) {
                        result = source.get(path);
                    }
                }
            }

            // If the result is a function - invoke it
            if (typeof result === "function") {
                index = path.lastIndexOf(".");

                // If the function is a member of a nested observable object make that nested observable the context (this) of the function
                if (index > 0) {
                    source = source.get(path.substring(0, index));
                }

                // Invoke the function
                that.start(source);

                result = result.call(source, that.source);

                that.stop(source);
            }

            // If the binding is resolved by a parent object
            if (source && source !== that.source) {

                that.currentSource = source; // save parent object

                // Listen for changes in the parent object
                source.unbind(CHANGE, that._change)
                      .bind(CHANGE, that._change);
            }

            that.stop(that.source);

            return result;
        },

        set: function(value) {
            var that = this,
                source = that.currentSource || that.source;

            source.set(that.path, value);
        },

        destroy: function() {
            if (this.observable) {
                this.source.unbind(CHANGE, this._change);
            }
        }
    });

    var EventBinding = Binding.extend( {
        get: function() {
            var source = this.source,
                path = this.path,
                index = 0,
                handler;

            handler = source.get(path);

            while (!handler && source) {
                source = this.parents[++index];

                if (source instanceof ObservableObject) {
                    handler = source.get(path);
                }
            }

            return proxy(handler, source);
        }
    });

    var TemplateBinding = Binding.extend( {
        init: function(source, path, template) {
            var that = this;

            Binding.fn.init.call(that, source, path);

            that.template = template;
        },

        render: function(value) {
            var html;

            this.start(this.source);

            html = kendo.render(this.template, value);

            this.stop(this.source);

            return html;
        }
    });

    var Binder = Class.extend({
        init: function(element, bindings, options) {
            this.element = element;
            this.bindings = bindings;
            this.options = options;
        },

        bind: function(binding, attribute) {
            var that = this;

            binding = attribute ? binding[attribute] : binding;

            binding.bind(CHANGE, function(e) {
                that.refresh(attribute || e);
            });

            that.refresh(attribute);
        },

        destroy: function() {
        }
    });

    binders.attr = Binder.extend({
        refresh: function(key) {
            this.element.setAttribute(key, this.bindings.attr[key].get());
        }
    });

    binders.style = Binder.extend({
        refresh: function(key) {
            this.element.style[key] = this.bindings.style[key].get() || "";
        }
    });

    binders.enabled = Binder.extend({
        refresh: function() {
            if (this.bindings.enabled.get()) {
                this.element.removeAttribute("disabled");
            } else {
                this.element.setAttribute("disabled", "disabled");
            }
        }
    });

    binders.readonly = Binder.extend({
       refresh: function() {
            if (this.bindings.readonly.get()) {
                this.element.setAttribute("readonly", "readonly");
            } else {
                this.element.removeAttribute("readonly");
            }
       }
    });

    binders.disabled = Binder.extend({
        refresh: function() {
            if (this.bindings.disabled.get()) {
                this.element.setAttribute("disabled", "disabled");
            } else {
                this.element.removeAttribute("disabled");
            }
        }
    });

    binders.events = Binder.extend({
        init: function(element, bindings, options) {
            Binder.fn.init.call(this, element, bindings, options);
            this.handlers = {};
        },

        refresh: function(key) {
            var element = $(this.element),
                binding = this.bindings.events[key],
                handler = this.handlers[key];

            if (handler) {
                element.off(key, handler);
            }

            handler = this.handlers[key] = binding.get();

            element.on(key, binding.source, handler);
        },

        destroy: function() {
            var element = $(this.element),
                handler;

            for (handler in this.handlers) {
                element.off(handler, this.handlers[handler]);
            }
        }
    });

    binders.text = Binder.extend({
        refresh: function() {
            var text = this.bindings.text.get();

            if (text == null) {
                text = "";
            }

            this.element[innerText] = text;
        }
    });

    binders.visible = Binder.extend({
        refresh: function() {
            if (this.bindings.visible.get()) {
                this.element.style.display = "";
            } else {
                this.element.style.display = "none";
            }
        }
    });

    binders.invisible = Binder.extend({
        refresh: function() {
            if (!this.bindings.invisible.get()) {
                this.element.style.display = "";
            } else {
                this.element.style.display = "none";
            }
        }
    });

    binders.html = Binder.extend({
        refresh: function() {
            this.element.innerHTML = this.bindings.html.get();
        }
    });

    binders.value = Binder.extend({
        init: function(element, bindings, options) {
            Binder.fn.init.call(this, element, bindings, options);

            this._change = proxy(this.change, this);
            this.eventName = options.valueUpdate || CHANGE;

            $(this.element).on(this.eventName, this._change);

            this._initChange = false;
        },

        change: function() {
            this._initChange = this.eventName != CHANGE;
            this.bindings[VALUE].set(this.element.value);
            this._initChange = false;
        },

        refresh: function() {
            if (!this._initChange) {
                var value = this.bindings[VALUE].get();

                if (value == null) {
                    value = "";
                }

                this.element.value = value;
            }

            this._initChange = false;
        },

        destroy: function() {
            $(this.element).off(this.eventName, this._change);
        }
    });

    binders.source = Binder.extend({
        init: function(element, bindings, options) {
            Binder.fn.init.call(this, element, bindings, options);
        },

        refresh: function(e) {
            var that = this,
                source = that.bindings.source.get();

            if (source instanceof ObservableArray) {
                e = e || {};

                if (e.action == "add") {
                    that.add(e.index, e.items);
                } else if (e.action == "remove") {
                    that.remove(e.index, e.items);
                } else if (e.action != "itemchange") {
                    that.render();
                }
            } else {
                that.render();
            }
        },

        container: function() {
            var element = this.element;

            if (element.nodeName.toLowerCase() == "table") {
                if (!element.tBodies[0]) {
                    element.appendChild(document.createElement("tbody"));
                }
                element = element.tBodies[0];
            }

            return element;
        },

        template: function() {
            var options = this.options,
                template = options.template,
                nodeName = this.container().nodeName.toLowerCase();

            if (!template) {
                if (nodeName == "select") {
                    if (options.valueField || options.textField) {
                        template = kendo.format('<option value="#:{0}#">#:{1}#</option>',
                            options.valueField || options.textField, options.textField || options.valueField);
                    } else {
                        template = "<option>#:data#</option>";
                    }
                } else if (nodeName == "tbody") {
                    template = "<tr><td>#:data#</td></tr>";
                } else if (nodeName == "ul" || nodeName == "ol") {
                    template = "<li>#:data#</li>";
                } else {
                    template = "#:data#";
                }

                template = kendo.template(template);
            }

            return template;
        },

        destroy: function() {
            var source = this.bindings.source.get();

            source.unbind(CHANGE, this._change);
        },

        add: function(index, items) {
            var element = this.container(),
                parents,
                idx,
                length,
                child,
                clone = element.cloneNode(false),
                reference = element.children[index];

            $(clone).html(kendo.render(this.template(), items));

            if (clone.children.length) {
                parents = this.bindings.source._parents();

                for (idx = 0, length = items.length; idx < length; idx++) {
                    child = clone.children[0];
                    element.insertBefore(child, reference || null);
                    bindElement(child, items[idx], this.options.roles, [items[idx]].concat(parents));
                }
            }
        },

        remove: function(index, items) {
            var idx, element = this.container();

            for (idx = 0; idx < items.length; idx++) {
                var child = element.children[index];
                unbindElementTree(child);
                element.removeChild(child);
            }
        },

        render: function() {
            var source = this.bindings.source.get(),
                parents,
                idx,
                length,
                element = this.container(),
                template = this.template(),
                parent;

            if (!(source instanceof ObservableArray) && toString.call(source) !== "[object Array]") {
                if (source.parent) {
                    parent = source.parent;
                }

                source = new ObservableArray([source]);

                if (source.parent) {
                    source.parent = parent;
                }
            }

            if (this.bindings.template) {
                unbindElementChildren(element);

                $(element).html(this.bindings.template.render(source));

                if (element.children.length) {
                    parents = this.bindings.source._parents();

                    for (idx = 0, length = source.length; idx < length; idx++) {
                        bindElement(element.children[idx], source[idx], this.options.roles, [source[idx]].concat(parents));
                    }
                }
            }
            else {
                $(element).html(kendo.render(template, source));
            }
        }
    });

    binders.input = {
        checked: Binder.extend({
            init: function(element, bindings, options) {
                Binder.fn.init.call(this, element, bindings, options);
                this._change = proxy(this.change, this);

                $(this.element).change(this._change);
            },
            change: function() {
                var element = this.element;
                var value = this.value();

                if (element.type == "radio") {
                    this.bindings[CHECKED].set(value);
                } else if (element.type == "checkbox") {
                    var source = this.bindings[CHECKED].get();
                    var index;

                    if (source instanceof ObservableArray) {
                        value = this.element.value;

                        if (value !== "on" && value !== "off") {
                            index = source.indexOf(value);
                            if (index > -1) {
                                source.splice(index, 1);
                            } else {
                                source.push(value);
                            }
                        }
                    } else {
                        this.bindings[CHECKED].set(value);
                    }
                }
            },

            refresh: function() {
                var value = this.bindings[CHECKED].get(),
                    source = value,
                    element = this.element;

                if (element.type == "checkbox") {
                    if (source instanceof ObservableArray) {
                        value = this.element.value;
                        if (source.indexOf(value) >= 0) {
                            value = true;
                        }
                    }

                    element.checked = value === true;
                } else if (element.type == "radio" && value != null) {
                    if (element.value === value.toString()) {
                        element.checked = true;
                    }
                }
            },

            value: function() {
                var element = this.element,
                    value = element.value;

                if (element.type == "checkbox") {
                    value = element.checked;
                }

                return value;
            },
            destroy: function() {
                $(this.element).off(CHANGE, this._change);
            }
        })
    };

    binders.select = {
        value: Binder.extend({
            init: function(target, bindings, options) {
                Binder.fn.init.call(this, target, bindings, options);

                this._change = proxy(this.change, this);
                $(this.element).change(this._change);
            },

            change: function() {
                var values = [],
                    element = this.element,
                    source,
                    field = this.options.valueField || this.options.textField,
                    valuePrimitive = this.options.valuePrimitive,
                    option,
                    valueIndex,
                    value,
                    idx,
                    length;

                for (idx = 0, length = element.options.length; idx < length; idx++) {
                    option = element.options[idx];

                    if (option.selected) {
                        value = option.attributes.value;

                        if (value && value.specified) {
                            value = option.value;
                        } else {
                            value = option.text;
                        }

                        values.push(value);
                    }
                }

                if (field) {
                    source = this.bindings.source.get();
                    for (valueIndex = 0; valueIndex < values.length; valueIndex++) {
                        for (idx = 0, length = source.length; idx < length; idx++) {
                            if (source[idx].get(field) == values[valueIndex]) {
                                values[valueIndex] = source[idx];
                                break;
                            }
                        }
                    }
                }

                value = this.bindings[VALUE].get();
                if (value instanceof ObservableArray) {
                    value.splice.apply(value, [0, value.length].concat(values));
                } else if (!valuePrimitive && (value instanceof ObservableObject || !field)) {
                    this.bindings[VALUE].set(values[0]);
                } else {
                    this.bindings[VALUE].set(values[0].get(field));
                }
            },
            refresh: function() {
                var optionIndex,
                    element = this.element,
                    options = element.options,
                    value = this.bindings[VALUE].get(),
                    values = value,
                    field = this.options.valueField || this.options.textField,
                    found = false,
                    optionValue;

                if (!(values instanceof ObservableArray)) {
                    values = new ObservableArray([value]);
                }

                element.selectedIndex = -1;

                for (var valueIndex = 0; valueIndex < values.length; valueIndex++) {
                    value = values[valueIndex];

                    if (field && value instanceof ObservableObject) {
                        value = value.get(field);
                    }

                    for (optionIndex = 0; optionIndex < options.length; optionIndex++) {
                        optionValue = options[optionIndex].value;

                        if (optionValue === "" && value !== "") {
                            optionValue = options[optionIndex].text;
                        }

                        if (optionValue == value) {
                            options[optionIndex].selected = true;
                            found = true;
                        }
                    }
                }
            },
            destroy: function() {
                $(this.element).off(CHANGE, this._change);
            }
        })
    };

    binders.widget = {
        events : Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);
                this.widget = widget;
                this.handlers = {};
            },

            refresh: function(key) {
                var binding = this.bindings.events[key],
                    handler = this.handlers[key];

                if (handler) {
                    this.widget.unbind(key, handler);
                }

                handler = binding.get();

                this.handlers[key] = function(e) {
                    e.data = binding.source;

                    handler(e);

                    if (e.data === binding.source) {
                        delete e.data;
                    }
                };

                this.widget.bind(key, this.handlers[key]);
            },

            destroy: function() {
                var handler;

                for (handler in this.handlers) {
                    this.widget.unbind(handler, this.handlers[handler]);
                }
            }
        }),

        checked: Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);

                this.widget = widget;
                this._change = proxy(this.change, this);
                this.widget.bind(CHANGE, this._change);
            },
            change: function() {
                this.bindings[CHECKED].set(this.value());
            },

            refresh: function() {
                this.widget.check(this.bindings[CHECKED].get() === true);
            },

            value: function() {
                var element = this.element,
                    value = element.value;

                if (value == "on" || value == "off") {
                    value = element.checked;
                }

                return value;
            },

            destroy: function() {
                this.widget.unbind(CHANGE, this._change);
            }
        }),

        visible: Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);

                this.widget = widget;
            },

            refresh: function() {
                var visible = this.bindings.visible.get();
                this.widget.wrapper[0].style.display = visible ? "" : "none";
            }
        }),

        invisible: Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);

                this.widget = widget;
            },

            refresh: function() {
                var invisible = this.bindings.invisible.get();
                this.widget.wrapper[0].style.display = invisible ? "none" : "";
            }
        }),

        enabled: Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);

                this.widget = widget;
            },

            refresh: function() {
                if (this.widget.enable) {
                    this.widget.enable(this.bindings.enabled.get());
                }
            }
        }),

        disabled: Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);

                this.widget = widget;
            },

            refresh: function() {
                if (this.widget.enable) {
                    this.widget.enable(!this.bindings.disabled.get());
                }
            }
        }),

        source: Binder.extend({
            init: function(widget, bindings, options) {
                var that = this;

                Binder.fn.init.call(that, widget.element[0], bindings, options);

                that.widget = widget;
                that._dataBinding = proxy(that.dataBinding, that);
                that._dataBound = proxy(that.dataBound, that);
                that._itemChange = proxy(that.itemChange, that);
            },

            itemChange: function(e) {
                bindElement(e.item[0], e.data, this._ns(e.ns), [e.data].concat(this.bindings.source._parents()));
            },

            dataBinding: function() {
                var idx,
                    length,
                    widget = this.widget,
                    items = widget.items();

                for (idx = 0, length = items.length; idx < length; idx++) {
                    unbindElementTree(items[idx]);
                }
            },

            _ns: function(ns) {
                ns = ns || kendo.ui;
                var all = [ kendo.ui, kendo.dataviz.ui, kendo.mobile.ui ];
                all.splice($.inArray(ns, all), 1);
                all.unshift(ns);

                return kendo.rolesFromNamespaces(all);
            },

            dataBound: function(e) {
                var idx,
                    length,
                    widget = this.widget,
                    items = widget.items(),
                    dataSource = widget.dataSource,
                    view = dataSource.view(),
                    parents,
                    groups = dataSource.group() || [];

                if (items.length) {
                    if (groups.length) {
                        view = flattenGroups(view);
                    }

                    parents = this.bindings.source._parents();

                    for (idx = 0, length = view.length; idx < length; idx++) {
                        bindElement(items[idx], view[idx], this._ns(e.ns), [view[idx]].concat(parents));
                    }
                }
            },

            refresh: function(e) {
                var that = this,
                    source,
                    widget = that.widget;

                e = e || {};

                if (!e.action) {
                    that.destroy();

                    widget.bind("dataBinding", that._dataBinding);
                    widget.bind("dataBound", that._dataBound);
                    widget.bind("itemChange", that._itemChange);

                    source = that.bindings.source.get();

                    if (widget.dataSource instanceof kendo.data.DataSource && widget.dataSource != source) {
                        if (source instanceof kendo.data.DataSource) {
                            widget.setDataSource(source);
                        } else if (source && source._dataSource) {
                            widget.setDataSource(source._dataSource);
                        } else {
                            widget.dataSource.data(source);
                        }
                    }
                }
            },

            destroy: function() {
                var widget = this.widget;

                widget.unbind("dataBinding", this._dataBinding);
                widget.unbind("dataBound", this._dataBound);
                widget.unbind("itemChange", this._itemChange);
            }
        }),

        value: Binder.extend({
            init: function(widget, bindings, options) {
                Binder.fn.init.call(this, widget.element[0], bindings, options);

                this.widget = widget;
                this._change = $.proxy(this.change, this);
                this.widget.first(CHANGE, this._change);

                var value = this.bindings.value.get();

                this._valueIsObservableObject = !options.valuePrimitive && (value == null || value instanceof ObservableObject);
                this._valueIsObservableArray = value instanceof ObservableArray;
                this._initChange = false;
            },

            change: function() {
                var value = this.widget.value(),
                    field = this.options.dataValueField || this.options.dataTextField,
                    isArray = toString.call(value) === "[object Array]",
                    isObservableObject = this._valueIsObservableObject,
                    valueIndex, valueLength, values = [],
                    sourceItem, sourceValue,
                    idx, length, source;

                this._initChange = true;

                if (field) {

                    if (this.bindings.source) {
                        source = this.bindings.source.get();
                    }

                    if (value === "" && (isObservableObject || this.options.valuePrimitive)) {
                        value = null;
                    } else {
                        if (!source || source instanceof kendo.data.DataSource) {
                            source = this.widget.dataSource.view();
                        }

                        if (isArray) {
                            valueLength = value.length;
                            values = value.slice(0);
                        }

                        for (idx = 0, length = source.length; idx < length; idx++) {
                            sourceItem = source[idx];
                            sourceValue = sourceItem.get(field);

                            if (isArray) {
                                for (valueIndex = 0; valueIndex < valueLength; valueIndex++) {
                                    if (sourceValue == values[valueIndex]) {
                                        values[valueIndex] = sourceItem;
                                        break;
                                    }
                                }
                            } else if (sourceValue == value) {
                                value = isObservableObject ? sourceItem : sourceValue;
                                break;
                            }
                        }

                        if (values[0]) {
                            if (this._valueIsObservableArray) {
                                value = values;
                            } else if (isObservableObject || !field) {
                                value = values[0];
                            } else {
                                value = values[0].get(field);
                            }
                        }
                    }
                }

                this.bindings.value.set(value);
                this._initChange = false;
            },

            refresh: function() {

                if (!this._initChange) {
                    var field = this.options.dataValueField || this.options.dataTextField,
                        value = this.bindings.value.get(),
                              idx = 0, length,
                              values = [];

                    if (field) {
                        if (value instanceof ObservableArray) {
                            for (length = value.length; idx < length; idx++) {
                                values[idx] = value[idx].get(field);
                            }
                            value = values;
                        } else if (value instanceof ObservableObject) {
                            value = value.get(field);
                        }
                    }
                    this.widget.value(value);
                }

                this._initChange = false;
            },

            destroy: function() {
                this.widget.unbind(CHANGE, this._change);
            }
        }),

        multiselect: {
            value: Binder.extend({
                init: function(widget, bindings, options) {
                    Binder.fn.init.call(this, widget.element[0], bindings, options);

                    this.widget = widget;
                    this._change = $.proxy(this.change, this);
                    this.widget.first(CHANGE, this._change);
                    this._initChange = false;
                },

                change: function() {
                    var that = this,
                        value = that.bindings[VALUE].get(),
                        valuePrimitive = that.options.valuePrimitive,
                        values = valuePrimitive ? that.widget.value() : that.widget.dataItems();

                    that._initChange = true;

                    if (value instanceof ObservableArray) {
                        value.splice.apply(value, [0, value.length].concat(values));
                    } else {
                        that.bindings[VALUE].set(values);
                    }

                    that._initChange = false;
                },

                refresh: function() {
                    if (!this._initChange) {
                        var field = this.options.dataValueField || this.options.dataTextField,
                            value = this.bindings.value.get(),
                            idx = 0, length,
                            values = [],
                            selectedValue;

                        if (field) {
                            if (value instanceof ObservableArray) {
                                for (length = value.length; idx < length; idx++) {
                                    selectedValue = value[idx];
                                    values[idx] = selectedValue.get ? selectedValue.get(field) : selectedValue;
                                }
                                value = values;
                            } else if (value instanceof ObservableObject) {
                                value = value.get(field);
                            }
                        }

                        this.widget.value(value);
                    }
                },

                destroy: function() {
                    this.widget.unbind(CHANGE, this._change);
                }

            })
        }
    };

    var BindingTarget = Class.extend( {
        init: function(target, options) {
            this.target = target;
            this.options = options;
            this.toDestroy = [];
        },

        bind: function(bindings) {
            var nodeName = this.target.nodeName.toLowerCase(),
                key,
                hasValue,
                hasSource,
                hasEvents,
                specificBinders = binders[nodeName] || {};

            for (key in bindings) {
                if (key == VALUE) {
                    hasValue = true;
                } else if (key == SOURCE) {
                    hasSource = true;
                } else if (key == EVENTS) {
                    hasEvents = true;
                } else {
                    this.applyBinding(key, bindings, specificBinders);
                }
            }

            if (hasSource) {
                this.applyBinding(SOURCE, bindings, specificBinders);
            }

            if (hasValue) {
                this.applyBinding(VALUE, bindings, specificBinders);
            }

            if (hasEvents) {
                this.applyBinding(EVENTS, bindings, specificBinders);
            }
        },

        applyBinding: function(name, bindings, specificBinders) {
            var binder = specificBinders[name] || binders[name],
                toDestroy = this.toDestroy,
                attribute,
                binding = bindings[name];

            if (binder) {
                binder = new binder(this.target, bindings, this.options);

                toDestroy.push(binder);

                if (binding instanceof Binding) {
                    binder.bind(binding);
                    toDestroy.push(binding);
                } else {
                    for (attribute in binding) {
                        binder.bind(binding, attribute);
                        toDestroy.push(binding[attribute]);
                    }
                }
            } else if (name !== "template") {
                throw new Error("The " + name + " binding is not supported by the " + this.target.nodeName.toLowerCase() + " element");
            }
        },

        destroy: function() {
            var idx,
                length,
                toDestroy = this.toDestroy;

            for (idx = 0, length = toDestroy.length; idx < length; idx++) {
                toDestroy[idx].destroy();
            }
        }
    });

    var WidgetBindingTarget = BindingTarget.extend( {
        bind: function(bindings) {
            var that = this,
                binding,
                hasValue = false,
                hasSource = false,
                specificBinders = binders.widget[that.target.options.name.toLowerCase()] || {};

            for (binding in bindings) {
                if (binding == VALUE) {
                    hasValue = true;
                } else if (binding == SOURCE) {
                    hasSource = true;
                } else {
                    that.applyBinding(binding, bindings);
                }
            }

            if (hasSource) {
                that.applyBinding(SOURCE, bindings);
            }

            if (hasValue) {
                that.applyBinding(VALUE, bindings, specificBinders[VALUE]);
            }
        },

        applyBinding: function(name, bindings, specificBinder) {
            var binder = specificBinder || binders.widget[name],
                toDestroy = this.toDestroy,
                attribute,
                binding = bindings[name];

            if (binder) {
                binder = new binder(this.target, bindings, this.target.options);

                toDestroy.push(binder);


                if (binding instanceof Binding) {
                    binder.bind(binding);
                    toDestroy.push(binding);
                } else {
                    for (attribute in binding) {
                        binder.bind(binding, attribute);
                        toDestroy.push(binding[attribute]);
                    }
                }
            } else {
                throw new Error("The " + name + " binding is not supported by the " + this.target.options.name + " widget");
            }
        }
    });

    function flattenGroups(data) {
        var idx, length, result = [];

        for (idx = 0, length = data.length; idx < length; idx++) {
            if (data[idx].hasSubgroups) {
                result = result.concat(flattenGroups(data[idx].items));
            } else {
                result = result.concat(data[idx].items);
            }
        }
        return result;
    }

    function bindingTargetForRole(role, element, roles) {
        var type = roles[role];

        if (type) {
            return new WidgetBindingTarget(kendo.initWidget(element, type.options, roles));
        }
    }

    var keyValueRegExp = /[A-Za-z0-9_\-]+:(\{([^}]*)\}|[^,}]+)/g,
        whiteSpaceRegExp = /\s/g;

    function parseBindings(bind) {
        var result = {},
            idx,
            length,
            token,
            colonIndex,
            key,
            value,
            tokens;

        tokens = bind.match(keyValueRegExp);

        for (idx = 0, length = tokens.length; idx < length; idx++) {
            token = tokens[idx];
            colonIndex = token.indexOf(":");

            key = token.substring(0, colonIndex);
            value = token.substring(colonIndex + 1);

            if (value.charAt(0) == "{") {
                value = parseBindings(value);
            }

            result[key] = value;
        }

        return result;
    }

    function createBindings(bindings, source, type) {
        var binding,
            result = {};

        for (binding in bindings) {
            result[binding] = new type(source, bindings[binding]);
        }

        return result;
    }

    function bindElement(element, source, roles, parents) {
        var role = element.getAttribute("data-" + kendo.ns + "role"),
            idx,
            bind = element.getAttribute("data-" + kendo.ns + "bind"),
            children = element.children,
            childrenCopy = [],
            deep = true,
            bindings,
            options = {},
            target;

        parents = parents || [source];

        if (role || bind) {
            unbindElement(element);
        }

        if (role) {
            target = bindingTargetForRole(role, element, roles);
        }

        if (bind) {
            bind = parseBindings(bind.replace(whiteSpaceRegExp, ""));

            if (!target) {
                options = kendo.parseOptions(element, {textField: "", valueField: "", template: "", valueUpdate: CHANGE, valuePrimitive: false});
                options.roles = roles;
                target = new BindingTarget(element, options);
            }

            target.source = source;

            bindings = createBindings(bind, parents, Binding);

            if (options.template) {
                bindings.template = new TemplateBinding(parents, "", options.template);
            }

            if (bindings.click) {
                bind.events = bind.events || {};
                bind.events.click = bind.click;
                delete bindings.click;
            }

            if (bindings.source) {
                deep = false;
            }

            if (bind.attr) {
                bindings.attr = createBindings(bind.attr, parents, Binding);
            }

            if (bind.style) {
                bindings.style = createBindings(bind.style, parents, Binding);
            }

            if (bind.events) {
                bindings.events = createBindings(bind.events, parents, EventBinding);
            }

            target.bind(bindings);
        }

        if (target) {
            element.kendoBindingTarget = target;
        }

        if (deep && children) {
            // https://github.com/telerik/kendo/issues/1240 for the weirdness.
            for (idx = 0; idx < children.length; idx++) {
                childrenCopy[idx] = children[idx];
            }

            for (idx = 0; idx < childrenCopy.length; idx++) {
                bindElement(childrenCopy[idx], source, roles, parents);
            }
        }
    }

    function bind(dom, object) {
        var idx,
            length,
            node,
            roles = kendo.rolesFromNamespaces([].slice.call(arguments, 2));

        object = kendo.observable(object);
        dom = $(dom);

        for (idx = 0, length = dom.length; idx < length; idx++) {
            node = dom[idx];
            if (node.nodeType === 1) {
                bindElement(node, object, roles);
            }
        }
    }

    function unbindElement(element) {
        var bindingTarget = element.kendoBindingTarget;

        if (bindingTarget) {
            bindingTarget.destroy();

            if ($.support.deleteExpando) {
                delete element.kendoBindingTarget;
            } else if (element.removeAttribute) {
                element.removeAttribute("kendoBindingTarget");
            } else {
                element.kendoBindingTarget = null;
            }
        }
    }

    function unbindElementTree(element) {
        unbindElement(element);

        unbindElementChildren(element);
    }

    function unbindElementChildren(element) {
        var children = element.children;

        if (children) {
            for (var idx = 0, length = children.length; idx < length; idx++) {
                unbindElementTree(children[idx]);
            }
        }
    }

    function unbind(dom) {
        var idx, length;

        dom = $(dom);

        for (idx = 0, length = dom.length; idx < length; idx++ ) {
            unbindElementTree(dom[idx]);
        }
    }

    function notify(widget, namespace) {
        var element = widget.element,
            bindingTarget = element[0].kendoBindingTarget;

        if (bindingTarget) {
            bind(element, bindingTarget.source, namespace);
        }
    }

    kendo.unbind = unbind;
    kendo.bind = bind;
    kendo.data.binders = binders;
    kendo.data.Binder = Binder;
    kendo.notify = notify;

    kendo.observable = function(object) {
        if (!(object instanceof ObservableObject)) {
            object = new ObservableObject(object);
        }

        return object;
    };

    kendo.observableHierarchy = function(array) {
        var dataSource = kendo.data.HierarchicalDataSource.create(array);

        function recursiveRead(data) {
            var i, children;

            for (i = 0; i < data.length; i++) {
                data[i]._initChildren();

                children = data[i].children;

                children.fetch();

                data[i].items = children.data();

                recursiveRead(data[i].items);
            }
        }

        dataSource.fetch();

        recursiveRead(dataSource.data());

        dataSource._data._dataSource = dataSource;

        return dataSource._data;
    };

})(window.kendo.jQuery);
