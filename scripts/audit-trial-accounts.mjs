import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  adapter: new PrismaMariaDb(process.env.DATABASE_URL || ""),
});

const knownDefaults = new Set(["123456", "admin123"]);

try {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      username: true,
      password: true,
      name: true,
      role: true,
      isActive: true,
    },
    orderBy: { id: "asc" },
  });

  const weak = [];
  for (const user of users) {
    for (const candidate of knownDefaults) {
      if (await bcrypt.compare(candidate, user.password)) {
        weak.push(user.username);
        break;
      }
    }
  }

  console.log(`账号总数：${users.length}`);
  for (const user of users) {
    console.log(
      `- ${user.username} / ${user.name || "-"} / ${user.role || "-"} / ${
        user.isActive ? "启用" : "停用"
      }`
    );
  }

  if (weak.length > 0) {
    console.error(`发现仍使用已知弱口令的账号：${weak.join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("未发现已知默认弱口令。");
  }
} finally {
  await prisma.$disconnect();
}
