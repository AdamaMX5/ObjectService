const { GraphQLScalarType, Kind } = require('graphql');
const svc = require('../services/objectService');

function parseLiteral(ast) {
  switch (ast.kind) {
    case Kind.STRING:  return ast.value;
    case Kind.INT:     return parseInt(ast.value, 10);
    case Kind.FLOAT:   return parseFloat(ast.value);
    case Kind.BOOLEAN: return ast.value;
    case Kind.NULL:    return null;
    case Kind.LIST:    return ast.values.map(parseLiteral);
    case Kind.OBJECT:
      return ast.fields.reduce((obj, field) => {
        obj[field.name.value] = parseLiteral(field.value);
        return obj;
      }, {});
    default: return null;
  }
}

const JSONScalar = new GraphQLScalarType({
  name: 'JSON',
  description: 'Arbitrary JSON value',
  serialize:   (value) => value,
  parseValue:  (value) => value,
  parseLiteral,
});

function requireUser(user) {
  if (!user) throw new Error('Authentication required');
}

function requireAdminUser(user) {
  requireUser(user);
  if (!user.roles?.includes('admin')) throw new Error('Admin role required');
}

const resolvers = {
  JSON: JSONScalar,

  Query: {
    getObject: async (_, { collection, id }, { user }) => {
      const doc = await svc.getObject(collection, id);
      if (!doc) return null;
      if (!doc.isPublic && !user) throw new Error('Authentication required to access private objects');
      return doc;
    },

    listObjects: async (_, { collection, page = 1, limit = 20, isPublic, app, tags, refs }, { user }) => {
      const filter = {};
      if (!user) {
        filter.isPublic = true;
      } else if (isPublic !== undefined) {
        filter.isPublic = isPublic;
      }
      if (app) filter.app = app;
      if (tags?.length) filter.tags = tags;
      if (refs) filter.refs = refs;

      return svc.listObjects(collection, { page, limit: Math.min(limit, 100), ...filter });
    },

    searchObjects: async (_, { collection, query, page = 1, limit = 20 }, { user }) => {
      return svc.searchObjects(collection, query, {
        page,
        limit: Math.min(limit, 100),
        isPublicOnly: !user,
      });
    },

    listCollections: async (_, __, { user }) => {
      requireUser(user);
      return svc.listCollections();
    },

    listIndexes: async (_, __, { user }) => {
      requireAdminUser(user);
      return svc.listIndexes();
    },
  },

  Mutation: {
    createObject: async (_, { collection, data, refs, isPublic = false, app, tags = [] }, { user }) => {
      requireUser(user);
      return svc.createObject(collection, { data, refs, isPublic, app, tags, createdBy: user.sub });
    },

    updateObject: async (_, { id, data, refs, isPublic, app, tags }, { user }) => {
      requireUser(user);
      const doc = await svc.updateObject(id, { data, refs, isPublic, app, tags, updatedBy: user.sub });
      if (!doc) throw new Error('Object not found');
      return doc;
    },

    patchObject: async (_, { id, data, refs, merge = true }, { user }) => {
      requireUser(user);
      if (!data && !refs) throw new Error('"data" or "refs" is required');
      const doc = await svc.patchObject(id, { data, refs, merge, updatedBy: user.sub });
      if (!doc) throw new Error('Object not found');
      return doc;
    },

    deleteObject: async (_, { id }, { user }) => {
      requireUser(user);
      return svc.deleteObject(id);
    },

    createDataIndex: async (_, { field, unique = false }, { user }) => {
      requireAdminUser(user);
      return svc.createDataIndex(field, { unique });
    },

    dropIndex: async (_, { name }, { user }) => {
      requireAdminUser(user);
      return svc.dropIndex(name);
    },
  },
};

module.exports = { resolvers };
