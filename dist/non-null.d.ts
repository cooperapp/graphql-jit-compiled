import { GraphQLError } from "graphql";
import { ExecutionContext } from "graphql/execution/execute";
export declare type NullTrimmer = (data: any, errors: GraphQLError[]) => any;
/**
 *
 * @param {ExecutionContext} exeContext
 * @returns {(data: any, errors: GraphQLError[]) => {data: any; errors: GraphQLError[]}}
 */
export declare function createNullTrimmer(exeContext: ExecutionContext): NullTrimmer;
