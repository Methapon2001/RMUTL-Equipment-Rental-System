import { Equipment, PrismaClient } from "@prisma/client";
import { FastifyReply, FastifyRequest } from "fastify";

const prisma = new PrismaClient();

type Param = {
  id: number;
};

type Query = {
  limit: number;
  offset: number;
} & Equipment;

type EquipmentWithCalculatedFields<T> = T & {
  remain: number;
  broken: number;
};

async function calculateFields(
  equipment: Equipment,
): Promise<EquipmentWithCalculatedFields<Equipment>> {
  const remains = await prisma.rent.aggregate({
    _sum: {
      count: true,
    },
    where: {
      equipmentId: equipment.id,
      status: {
        not: "rejected",
      },
      return: null,
    },
  });

  const brokens = await prisma.broken.aggregate({
    _sum: {
      count: true,
    },
    where: {
      equipmentId: equipment.id,
      status: "pending",
    },
  });

  return {
    ...equipment,
    remain:
      equipment.count - (remains._sum.count != null ? remains._sum.count : 0) - (brokens._sum.count ?? 0),
    broken: brokens._sum.count ?? 0,
  };
}

export async function createEquipment(
  req: FastifyRequest<{ Body: Equipment }>,
  res: FastifyReply,
) {
  const equipment = await prisma.equipment.create({
    data: req.body,
    include: {
      brand: true,
    },
  });

  return res.status(200).send({
    result: "ok",
    data: { ...equipment, remain: equipment.count },
  });
}

export async function requestEquipment(
  req: FastifyRequest<{ Params: Param; Querystring: Query }>,
  res: FastifyReply,
) {
  const { id } = req.params;
  const { name, limit, offset } = req.query;

  const equipment = id
    ? await prisma.equipment.findFirst({
        where: {
          id: id,
        },
        include: {
          brand: true,
        },
      })
    : await prisma.equipment.findMany({
        where: {
          name: {
            contains: name,
          },
        },
        include: {
          brand: true,
        },
        skip: offset,
        take: limit,
      });

  const count = id
    ? undefined
    : await prisma.equipment.count({
        where: {
          name: {
            contains: name,
          },
        },
      });

  let data: EquipmentWithCalculatedFields<Equipment>[] = [];

  if (Array.isArray(equipment)) {
    for (let i = 0; i < equipment.length; i++) {
      data = [...data, await calculateFields(equipment[i])];
    }
  }

  if (id && equipment != null) {
    data.push(await calculateFields(equipment as Equipment));
  }

  return res.status(200).send({
    result: "ok",
    data: id ? data[0] : data,
    limit: limit,
    offset: offset,
    total: count,
  });
}

export async function updateEquipment(
  req: FastifyRequest<{ Body: Equipment; Params: Param }>,
  res: FastifyReply,
) {
  const { id } = req.params;

  const equipment = await prisma.equipment.update({
    where: {
      id: id,
    },
    include: {
      brand: true,
    },
    data: req.body,
  });

  const data = await calculateFields(equipment);

  return res.status(200).send({
    result: "ok",
    data: data,
  });
}

export async function deleteEquipment(
  req: FastifyRequest<{ Body: Equipment; Params: Param }>,
  res: FastifyReply,
) {
  const { id } = req.params;

  const equipment = await prisma.equipment.delete({
    where: {
      id: id,
    },
    include: {
      brand: true,
    },
  });

  return res.status(200).send({
    result: "ok",
    data: equipment,
  });
}

export async function getListEquipment(req: FastifyRequest, res: FastifyReply) {
  const equipment = await prisma.equipment.findMany({
    distinct: "name",
    select: {
      name: true,
    },
  });

  return res.status(200).send({
    result: "ok",
    data: equipment,
  });
}
