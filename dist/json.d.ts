import { ExecutionContext } from "graphql/execution/execute";
import { JSONSchema6 } from "json-schema";
/**
 * GQL -> JSON Schema transform
 *
 * @param exeContext
 * @return     {object}  A plain JavaScript object which conforms to JSON Schema
 */
export declare function queryToJSONSchema(exeContext: ExecutionContext): JSONSchema6;
