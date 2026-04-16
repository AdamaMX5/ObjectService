const typeDefs = `#graphql
  scalar JSON

  type ObjectDocument {
    id: ID!
    collectionName: String!
    data: JSON!
    """
    Foreign-key store — every key is covered by a wildcard index.
    Use refs for any field you join or filter on frequently.
    """
    refs: JSON!
    createdBy: String
    updatedBy: String
    createdAt: String!
    updatedAt: String!
    isPublic: Boolean!
    app: String
    tags: [String!]!
  }

  type ObjectList {
    objects: [ObjectDocument!]!
    total: Int!
    page: Int!
    limit: Int!
    pages: Int!
  }

  type IndexInfo {
    name: String!
    key: JSON!
    unique: Boolean!
  }

  type Query {
    """Get a single object by collection and ID."""
    getObject(collection: String!, id: ID!): ObjectDocument

    """
    List objects in a collection.
    refs: JSON object whose keys are matched against the indexed refs field,
    e.g. { carId: "abc", userId: "xyz" } — always an indexed lookup.
    """
    listObjects(
      collection: String!
      page: Int
      limit: Int
      isPublic: Boolean
      app: String
      tags: [String]
      refs: JSON
    ): ObjectList!

    """
    Search objects by matching data fields (equality).
    Keys are mapped to data.<key> — efficient only when a data index exists for that field.
    For FK lookups use listObjects with refs instead.
    """
    searchObjects(
      collection: String!
      query: JSON!
      page: Int
      limit: Int
    ): ObjectList!

    """List all collection names. Requires authentication."""
    listCollections: [String!]!

    """List all MongoDB indexes on the ObjectDocument collection. Requires admin role."""
    listIndexes: [IndexInfo!]!
  }

  type Mutation {
    """Create a new object. Requires authentication."""
    createObject(
      collection: String!
      data: JSON!
      refs: JSON
      isPublic: Boolean
      app: String
      tags: [String]
    ): ObjectDocument!

    """Replace an existing object's fields. Requires authentication."""
    updateObject(
      id: ID!
      data: JSON
      refs: JSON
      isPublic: Boolean
      app: String
      tags: [String]
    ): ObjectDocument!

    """
    Partially update an object.
    merge=true (default): shallow-merges data and refs into existing values.
    merge=false: replaces data/refs entirely.
    Requires authentication.
    """
    patchObject(
      id: ID!
      data: JSON
      refs: JSON
      merge: Boolean
    ): ObjectDocument!

    """Delete an object by ID. Requires authentication."""
    deleteObject(id: ID!): Boolean!

    """
    Create a compound index { collectionName, data.<field> } for efficient data queries.
    Supports dot-notation: field="address.city".
    Requires admin role.
    """
    createDataIndex(field: String!, unique: Boolean): String!

    """Drop an index by name. Requires admin role."""
    dropIndex(name: String!): Boolean!
  }
`;

module.exports = { typeDefs };
