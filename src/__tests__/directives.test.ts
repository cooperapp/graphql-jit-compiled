/**
 * Based on https://github.com/graphql/graphql-js/blob/master/src/execution/__tests__/directives-test.js
 */

import {
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
  parse
} from "graphql";
import { compileQuery } from "../index";

const schema = new GraphQLSchema({
  query: new GraphQLObjectType({
    name: "TestType",
    fields: {
      a: {
        type: GraphQLString,
        resolve() {
          return "a";
        }
      },
      b: {
        type: GraphQLString,
        resolve() {
          return "b";
        }
      }
    }
  })
});

const data = {};

function executeTestQuery(query: string) {
  const ast = parse(query);
  const compiled: any = compileQuery(schema, ast, "");
  return compiled.query(data, undefined, {});
}

// tslint:disable-next-line
describe("Execute: handles directives", () => {
  describe("works without directives", () => {
    test("basic query works", () => {
      const result = executeTestQuery("{ a, b }");

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });
  });

  describe("works on scalars", () => {
    // tslint:disable-next-line
    test("if true includes scalar", () => {
      const result = executeTestQuery("{ a, b @include(if: true) }");

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });

    test("if false omits on scalar", () => {
      const result = executeTestQuery("{ a, b @include(if: false) }");

      expect(result).toEqual({
        data: { a: "a" }
      });
    });

    // tslint:disable-next-line
    test("unless false includes scalar", () => {
      const result = executeTestQuery("{ a, b @skip(if: false) }");

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });

    // tslint:disable-next-line
    test("unless true omits scalar", () => {
      const result = executeTestQuery("{ a, b @skip(if: true) }");

      expect(result).toEqual({
        data: { a: "a" }
      });
    });
  });

  describe("works on fragment spreads", () => {
    test("if false omits fragment spread", () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @include(if: false)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });

    test("if true includes fragment spread", () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @include(if: true)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });

    test("unless false includes fragment spread", () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @skip(if: false)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });

    test("unless true omits fragment spread", () => {
      const result = executeTestQuery(`
        query {
          a
          ...Frag @skip(if: true)
        }
        fragment Frag on TestType {
          b
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });
  });

  describe("works on inline fragment", () => {
    test("if false omits inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @include(if: false) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });

    test("if true includes inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @include(if: true) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });
    test("unless false includes inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @skip(if: false) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });
    test("unless true includes inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... on TestType @skip(if: true) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });
  });

  describe("works on anonymous inline fragment", () => {
    test("if false omits anonymous inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... @include(if: false) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });

    test("if true includes anonymous inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... @include(if: true) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });
    test("unless false includes anonymous inline fragment", () => {
      const result = executeTestQuery(`
        query Q {
          a
          ... @skip(if: false) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });
    test("unless true includes anonymous inline fragment", () => {
      const result = executeTestQuery(`
        query {
          a
          ... @skip(if: true) {
            b
          }
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });
  });

  describe("works with skip and include directives", () => {
    test("include and no skip", () => {
      const result = executeTestQuery(`
        {
          a
          b @include(if: true) @skip(if: false)
        }
      `);

      expect(result).toEqual({
        data: { a: "a", b: "b" }
      });
    });

    test("include and skip", () => {
      const result = executeTestQuery(`
        {
          a
          b @include(if: true) @skip(if: true)
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });

    test("no include or skip", () => {
      const result = executeTestQuery(`
        {
          a
          b @include(if: false) @skip(if: false)
        }
      `);

      expect(result).toEqual({
        data: { a: "a" }
      });
    });
  });
});
