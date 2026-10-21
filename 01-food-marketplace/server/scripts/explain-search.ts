import { connectDatabase, disconnectDatabase } from "../src/shared/db.js";
import { Product } from "../src/modules/products/product.model.js";

async function main() {
  const term = process.argv[2] ?? "rice";
  await connectDatabase();
  const plan = (await Product.find(
    { $text: { $search: term } },
    { score: { $meta: "textScore" } }
  ).explain("executionStats")) as any;

  const winningPlan = plan.queryPlanner?.winningPlan;
  console.log(
    JSON.stringify(
      {
        searchTerm: term,
        winningPlan,
        executionStats: plan.executionStats
      },
      null,
      2
    )
  );
  await disconnectDatabase();
}

main().catch(async (error) => {
  console.error(error);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
