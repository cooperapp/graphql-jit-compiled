"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.flattenPath = exports.addPath = exports.computeLocations = exports.valueFromAST = exports.getArgumentDefs = exports.collectSubfields = exports.resolveFieldDef = exports.collectFields = void 0;
const graphql_1 = require("graphql");
const execute_1 = require("graphql/execution/execute");
const language_1 = require("graphql/language");
const type_1 = require("graphql/type");
const inspect_1 = __importDefault(require("./inspect"));
const inspect = inspect_1.default();
/**
 * Given a selectionSet, adds all of the fields in that selection to
 * the passed in map of fields, and returns it at the end.
 *
 * CollectFields requires the "runtime type" of an object. For a field which
 * returns an Interface or Union type, the "runtime type" will be the actual
 * Object type returned by that field.
 */
function collectFields(exeContext, runtimeType, selectionSet, fields, visitedFragmentNames) {
    for (const selection of selectionSet.selections) {
        switch (selection.kind) {
            case language_1.Kind.FIELD:
                if (!shouldIncludeNode(exeContext, selection)) {
                    continue;
                }
                const name = getFieldEntryKey(selection);
                if (!fields[name]) {
                    fields[name] = [];
                }
                fields[name].push(selection);
                break;
            case language_1.Kind.INLINE_FRAGMENT:
                if (!shouldIncludeNode(exeContext, selection) ||
                    !doesFragmentConditionMatch(exeContext, selection, runtimeType)) {
                    continue;
                }
                collectFields(exeContext, runtimeType, selection.selectionSet, fields, visitedFragmentNames);
                break;
            case language_1.Kind.FRAGMENT_SPREAD:
                const fragName = selection.name.value;
                if (visitedFragmentNames[fragName] ||
                    !shouldIncludeNode(exeContext, selection)) {
                    continue;
                }
                visitedFragmentNames[fragName] = true;
                const fragment = exeContext.fragments[fragName];
                if (!fragment ||
                    !doesFragmentConditionMatch(exeContext, fragment, runtimeType)) {
                    continue;
                }
                collectFields(exeContext, runtimeType, fragment.selectionSet, fields, visitedFragmentNames);
                break;
        }
    }
    return fields;
}
exports.collectFields = collectFields;
/**
 * Determines if a field should be included based on the @include and @skip
 * directives, where @skip has higher precedence than @include.
 */
function shouldIncludeNode(exeContext, node) {
    const skip = graphql_1.getDirectiveValues(graphql_1.GraphQLSkipDirective, node, exeContext.variableValues);
    if (skip && skip.if === true) {
        return false;
    }
    const include = graphql_1.getDirectiveValues(graphql_1.GraphQLIncludeDirective, node, exeContext.variableValues);
    if (include && include.if === false) {
        return false;
    }
    return true;
}
/**
 * Determines if a fragment is applicable to the given type.
 */
function doesFragmentConditionMatch(exeContext, fragment, type) {
    const typeConditionNode = fragment.typeCondition;
    if (!typeConditionNode) {
        return true;
    }
    const conditionalType = graphql_1.typeFromAST(exeContext.schema, typeConditionNode);
    if (conditionalType === type) {
        return true;
    }
    if (!conditionalType) {
        return false;
    }
    if (type_1.isAbstractType(conditionalType)) {
        return exeContext.schema.isPossibleType(conditionalType, type);
    }
    return false;
}
/**
 * Implements the logic to compute the key of a given field's entry
 */
function getFieldEntryKey(node) {
    return node.alias ? node.alias.value : node.name.value;
}
/**
 * Resolves the field on the given source object. In particular, this
 * figures out the value that the field returns by calling its resolve function,
 * then calls completeValue to complete promises, serialize scalars, or execute
 * the sub-selection-set for objects.
 */
function resolveFieldDef(exeContext, parentType, fieldNodes) {
    const fieldNode = fieldNodes[0];
    const fieldName = fieldNode.name.value;
    return execute_1.getFieldDef(exeContext.schema, parentType, fieldName);
}
exports.resolveFieldDef = resolveFieldDef;
/**
 * A memoized collection of relevant subfields in the context of the return
 * type. Memoizing ensures the subfields are not repeatedly calculated, which
 * saves overhead when resolving lists of values.
 */
exports.collectSubfields = memoize3(_collectSubfields);
function _collectSubfields(exeContext, returnType, fieldNodes) {
    let subFieldNodes = Object.create(null);
    const visitedFragmentNames = Object.create(null);
    for (const fieldNode of fieldNodes) {
        const selectionSet = fieldNode.selectionSet;
        if (selectionSet) {
            subFieldNodes = collectFields(exeContext, returnType, selectionSet, subFieldNodes, visitedFragmentNames);
        }
    }
    return subFieldNodes;
}
function memoize3(fn) {
    let cache0;
    function memoized(a1, a2, a3) {
        if (!cache0) {
            cache0 = new WeakMap();
        }
        let cache1 = cache0.get(a1);
        let cache2;
        if (cache1) {
            cache2 = cache1.get(a2);
            if (cache2) {
                const cachedValue = cache2.get(a3);
                if (cachedValue !== undefined) {
                    return cachedValue;
                }
            }
        }
        else {
            cache1 = new WeakMap();
            cache0.set(a1, cache1);
        }
        if (!cache2) {
            cache2 = new WeakMap();
            cache1.set(a2, cache2);
        }
        const newValue = fn(...arguments);
        cache2.set(a3, newValue);
        return newValue;
    }
    return memoized;
}
/**
 * Prepares an object map of argument values given a list of argument
 * definitions and list of argument AST nodes.
 *
 * Note: The returned value is a plain Object with a prototype, since it is
 * exposed to user code. Care should be taken to not pull values from the
 * Object prototype.
 */
function getArgumentDefs(def, node) {
    const values = {};
    const missing = [];
    const argDefs = def.args;
    const argNodes = node.arguments || [];
    const argNodeMap = keyMap(argNodes, arg => arg.name.value);
    for (const argDef of argDefs) {
        const name = argDef.name;
        if (argDef.defaultValue !== undefined) {
            // Set the coerced value to the default
            values[name] = argDef.defaultValue;
        }
        const argType = argDef.type;
        const argumentNode = argNodeMap[name];
        let hasVariables = false;
        if (argumentNode && argumentNode.value.kind === language_1.Kind.VARIABLE) {
            hasVariables = true;
            missing.push({
                valueNode: argumentNode.value,
                path: addPath(undefined, name, "literal"),
                argument: { definition: argDef, node: argumentNode }
            });
        }
        else if (argumentNode) {
            const coercedValue = valueFromAST(argumentNode.value, argType);
            if (coercedValue === undefined) {
                // Note: ValuesOfCorrectType validation should catch this before
                // execution. This is a runtime check to ensure execution does not
                // continue with an invalid argument value.
                throw new graphql_1.GraphQLError(`Argument "${name}" of type \"${argType}\" has invalid value ${graphql_1.print(argumentNode.value)}.`, argumentNode.value);
            }
            if (isASTValueWithVariables(coercedValue)) {
                missing.push(...coercedValue.variables.map(({ valueNode, path }) => ({
                    valueNode,
                    path: addPath(path, name, "literal")
                })));
            }
            values[name] = coercedValue.value;
        }
        if (graphql_1.isNonNullType(argType) && values[name] === undefined && !hasVariables) {
            // If no value or a nullish value was provided to a variable with a
            // non-null type (required), produce an error.
            throw new graphql_1.GraphQLError(argumentNode
                ? `Argument "${name}" of non-null type ` +
                    `"${argType}" must not be null.`
                : `Argument "${name}" of required type ` +
                    `"${argType}" was not provided.`, node);
        }
    }
    return { values, missing };
}
exports.getArgumentDefs = getArgumentDefs;
function isASTValueWithVariables(x) {
    return !!x.variables;
}
function valueFromAST(valueNode, type) {
    if (graphql_1.isNonNullType(type)) {
        if (valueNode.kind === language_1.Kind.NULL) {
            return; // Invalid: intentionally return no value.
        }
        return valueFromAST(valueNode, type.ofType);
    }
    if (valueNode.kind === language_1.Kind.NULL) {
        // This is explicitly returning the value null.
        return {
            value: null
        };
    }
    if (valueNode.kind === language_1.Kind.VARIABLE) {
        return { value: null, variables: [{ valueNode, path: undefined }] };
    }
    if (graphql_1.isListType(type)) {
        const itemType = type.ofType;
        if (valueNode.kind === language_1.Kind.LIST) {
            const coercedValues = [];
            const variables = [];
            const itemNodes = valueNode.values;
            for (let i = 0; i < itemNodes.length; i++) {
                const itemNode = itemNodes[i];
                if (itemNode.kind === language_1.Kind.VARIABLE) {
                    coercedValues.push(null);
                    variables.push({
                        valueNode: itemNode,
                        path: addPath(undefined, i.toString(), "literal")
                    });
                }
                else {
                    const itemValue = valueFromAST(itemNode, itemType);
                    if (!itemValue) {
                        return; // Invalid: intentionally return no value.
                    }
                    coercedValues.push(itemValue.value);
                    if (isASTValueWithVariables(itemValue)) {
                        variables.push(...itemValue.variables.map(({ valueNode, path }) => ({
                            valueNode,
                            path: addPath(path, i.toString(), "literal")
                        })));
                    }
                }
            }
            return { value: coercedValues, variables };
        }
        // Single item which will be coerced to a list
        const coercedValue = valueFromAST(valueNode, itemType);
        if (coercedValue === undefined) {
            return; // Invalid: intentionally return no value.
        }
        if (isASTValueWithVariables(coercedValue)) {
            return {
                value: [coercedValue.value],
                variables: coercedValue.variables.map(({ valueNode, path }) => ({
                    valueNode,
                    path: addPath(path, "0", "literal")
                }))
            };
        }
        return { value: [coercedValue.value] };
    }
    if (graphql_1.isInputObjectType(type)) {
        if (valueNode.kind !== language_1.Kind.OBJECT) {
            return; // Invalid: intentionally return no value.
        }
        const coercedObj = Object.create(null);
        const variables = [];
        const fieldNodes = keyMap(valueNode.fields, field => field.name.value);
        const fields = Object.values(type.getFields());
        for (const field of fields) {
            if (field.defaultValue !== undefined) {
                coercedObj[field.name] = field.defaultValue;
            }
            const fieldNode = fieldNodes[field.name];
            if (!fieldNode) {
                continue;
            }
            const fieldValue = valueFromAST(fieldNode.value, field.type);
            if (!fieldValue) {
                return; // Invalid: intentionally return no value.
            }
            if (isASTValueWithVariables(fieldValue)) {
                variables.push(...fieldValue.variables.map(({ valueNode, path }) => ({
                    valueNode,
                    path: addPath(path, field.name, "literal")
                })));
            }
            coercedObj[field.name] = fieldValue.value;
        }
        return { value: coercedObj, variables };
    }
    if (graphql_1.isEnumType(type)) {
        if (valueNode.kind !== language_1.Kind.ENUM) {
            return; // Invalid: intentionally return no value.
        }
        const enumValue = type.getValue(valueNode.value);
        if (!enumValue) {
            return; // Invalid: intentionally return no value.
        }
        return { value: enumValue.value };
    }
    if (graphql_1.isScalarType(type)) {
        // Scalars fulfill parsing a literal value via parseLiteral().
        // Invalid values represent a failure to parse correctly, in which case
        // no value is returned.
        let result;
        try {
            if (type.parseLiteral.length > 1) {
                // tslint:disable-next-line
                console.error("Scalar with variable inputs detected for parsing AST literals. This is not supported.");
            }
            result = type.parseLiteral(valueNode, {});
        }
        catch (error) {
            return; // Invalid: intentionally return no value.
        }
        if (isInvalid(result)) {
            return; // Invalid: intentionally return no value.
        }
        return { value: result };
    }
    // Not reachable. All possible input types have been considered.
    /* istanbul ignore next */
    throw new Error(`Unexpected input type: "${inspect(type)}".`);
}
exports.valueFromAST = valueFromAST;
/**
 * Creates a keyed JS object from an array, given a function to produce the keys
 * for each value in the array.
 *
 * This provides a convenient lookup for the array items if the key function
 * produces unique results.
 *
 *     const phoneBook = [
 *       { name: 'Jon', num: '555-1234' },
 *       { name: 'Jenny', num: '867-5309' }
 *     ]
 *
 *     // { Jon: { name: 'Jon', num: '555-1234' },
 *     //   Jenny: { name: 'Jenny', num: '867-5309' } }
 *     const entriesByName = keyMap(
 *       phoneBook,
 *       entry => entry.name
 *     )
 *
 *     // { name: 'Jenny', num: '857-6309' }
 *     const jennyEntry = entriesByName['Jenny']
 *
 */
function keyMap(list, keyFn) {
    return list.reduce((map, item) => ((map[keyFn(item)] = item), map), Object.create(null));
}
function computeLocations(nodes) {
    return nodes.reduce((list, node) => {
        if (node.loc) {
            list.push(graphql_1.getLocation(node.loc.source, node.loc.start));
        }
        return list;
    }, []);
}
exports.computeLocations = computeLocations;
function addPath(responsePath, key, type = "literal") {
    return { prev: responsePath, key, type };
}
exports.addPath = addPath;
function flattenPath(path) {
    const flattened = [];
    let curr = path;
    while (curr) {
        flattened.push({ key: curr.key, type: curr.type });
        curr = curr.prev;
    }
    return flattened;
}
exports.flattenPath = flattenPath;
function isInvalid(value) {
    return value === undefined || value !== value;
}
//# sourceMappingURL=ast.js.map