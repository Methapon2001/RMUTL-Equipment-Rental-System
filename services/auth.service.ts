import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { PrismaClient, User } from "@prisma/client";

const prisma = new PrismaClient();

export default (instance: FastifyInstance) => {
  return {
    signOut: async (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => {
      return reply
        .status(200)
        .cookie("session", "")
        .send({
          result: "ok",
        });
    },

    signIn: async (
      request: FastifyRequest<{ Body: User }>,
      reply: FastifyReply,
    ) => {
      const user = await prisma.user.findFirst({
        where: {
          username: request.body.username,
        },
      });

      if (request.body.password == user?.password) {
        const token = instance.jwt.sign(user);

        delete (user as any).password;

        reply.status(200).cookie("session", token, {
          httpOnly: true,
        }).send({
          result: "ok",
          token: token,
          user: user,
        });
      } else {
        reply.code(401).send({
          result: "error",
          message: "Unauthorized.",
        });
      }
    },
  };
};
