"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryToJSONSchema = void 0;
/**
 * Mapping between GQL primitive types and JSON Schema property types
 *
 * @type       {<type>}
 */
const graphql_1 = require("graphql");
const execute_1 = require("graphql/execution/execute");
const ast_1 = require("./ast");
const PRIMITIVES = {
    Int: "integer",
    Float: "number",
    String: "string",
    Boolean: "boolean",
    ID: "string"
};
/**
 * GQL -> JSON Schema transform
 *
 * @param exeContext
 * @return     {object}  A plain JavaScript object which conforms to JSON Schema
 */
function queryToJSONSchema(exeContext) {
    const type = graphql_1.getOperationRootType(exeContext.schema, exeContext.operation);
    const fields = execute_1.collectFields(exeContext, type, exeContext.operation.selectionSet, Object.create(null), Object.create(null));
    const fieldProperties = Object.create(null);
    for (const responseName of Object.keys(fields)) {
        const fieldType = ast_1.resolveFieldDef(exeContext, type, fields[responseName]);
        if (!fieldType) {
            // if field does not exist, it should be ignored for compatibility concerns.
            // Usually, validation would stop it before getting here but this could be an old query
            continue;
        }
        fieldProperties[responseName] = transformNode(exeContext, fields[responseName], fieldType.type);
    }
    return {
        type: "object",
        properties: {
            data: {
                type: ["object", "null"],
                properties: fieldProperties
            },
            errors: {
                type: "array",
                items: {
                    type: "object",
                    additionalProperties: true,
                    properties: {
                        message: {
                            type: "string"
                        },
                        path: {
                            type: "array",
                            items: {
                                type: ["string", "number"]
                            }
                        },
                        locations: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    line: {
                                        type: "number"
                                    },
                                    column: {
                                        type: "number"
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    };
}
exports.queryToJSONSchema = queryToJSONSchema;
function transformNode(exeContext, fieldNodes, type) {
    if (graphql_1.isObjectType(type)) {
        const subfields = ast_1.collectSubfields(exeContext, type, fieldNodes);
        const properties = Object.create(null);
        for (const responseName of Object.keys(subfields)) {
            const fieldType = ast_1.resolveFieldDef(exeContext, type, subfields[responseName]);
            if (!fieldType) {
                // if field does not exist, it should be ignored for compatibility concerns.
                // Usually, validation would stop it before getting here but this could be an old query
                continue;
            }
            properties[responseName] = transformNode(exeContext, subfields[responseName], fieldType.type);
        }
        return {
            type: ["object", "null"],
            properties
        };
    }
    if (graphql_1.isListType(type)) {
        return {
            type: ["array", "null"],
            items: transformNode(exeContext, fieldNodes, type.ofType)
        };
    }
    if (graphql_1.isNonNullType(type)) {
        const nullable = transformNode(exeContext, fieldNodes, type.ofType);
        if (nullable.type && Array.isArray(nullable.type)) {
            const nonNullable = nullable.type.filter(x => x !== "null");
            return Object.assign(Object.assign({}, nullable), { type: nonNullable.length === 1 ? nonNullable[0] : nonNullable });
        }
        return {};
    }
    if (graphql_1.isEnumType(type)) {
        return {
            type: ["string", "null"]
        };
    }
    if (graphql_1.isScalarType(type)) {
        const jsonSchemaType = PRIMITIVES[type.name];
        if (!jsonSchemaType) {
            return {};
        }
        return {
            type: [jsonSchemaType, "null"]
        };
    }
    if (graphql_1.isAbstractType(type)) {
        return exeContext.schema.getPossibleTypes(type).reduce((res, t) => {
            const jsonSchema = transformNode(exeContext, fieldNodes, t);
            res.properties = Object.assign(Object.assign({}, res.properties), jsonSchema.properties);
            return res;
        }, {
            type: ["object", "null"],
            properties: {}
        });
    }
    throw new Error(`Got unhandled type: ${type.name}`);
}
//# sourceMappingURL=json.js.map