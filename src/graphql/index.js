const { ApolloServer } = require('@apollo/server');
const { expressMiddleware } = require('@apollo/server/express4');
const { ApolloServerPluginDrainHttpServer } = require('@apollo/server/plugin/drainHttpServer');
const express = require('express');
const { typeDefs } = require('./schema');
const { resolvers } = require('./resolvers');
const { verifyJwt } = require('../middleware/auth');

async function setupGraphQL(app, httpServer) {
  const server = new ApolloServer({
    typeDefs,
    resolvers,
    plugins: [ApolloServerPluginDrainHttpServer({ httpServer })],
  });

  await server.start();

  app.use(
    '/graphql',
    express.json(),
    expressMiddleware(server, {
      context: async ({ req }) => {
        let user = null;
        const authHeader = req.headers.authorization;
        if (authHeader?.startsWith('Bearer ')) {
          try {
            user = verifyJwt(authHeader.slice(7));
          } catch {
            // invalid token — context user stays null
          }
        }
        return { user };
      },
    })
  );

  return server;
}

module.exports = { setupGraphQL };
