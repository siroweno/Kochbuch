const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Kitab-Secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  // Verify secret token
  const secret = req.headers.get("X-Kitab-Secret") || "";
  const expectedSecret = Deno.env.get("KITAB_API_SECRET") || "";
  if (!expectedSecret || secret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await req.json();
  } catch (_e) {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }

  const recipe = body.recipe;
  if (!recipe || !recipe.title || !recipe.raw_ingredients || !recipe.instructions) {
    return new Response(
      JSON.stringify({ error: "Missing required fields: title, raw_ingredients, instructions" }),
      { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  // Use direct Postgres connection via SUPABASE_DB_URL (bypasses RLS completely)
  const dbUrl = Deno.env.get("SUPABASE_DB_URL")!;

  // Dynamically import postgres
  const { default: postgres } = await import("https://deno.land/x/postgresjs@v3.4.5/mod.js");
  const sql = postgres(dbUrl, { max: 1 });

  try {
    // Resolve created_by from email if provided
    let createdBy = recipe.created_by || null;
    if (!createdBy && recipe.created_by_email) {
      const profiles = await sql`
        SELECT id FROM public.profiles WHERE email = ${recipe.created_by_email.toLowerCase()} LIMIT 1
      `;
      if (profiles.length > 0) createdBy = profiles[0].id;
    }

    const result = await sql`
      INSERT INTO public.recipes (
        title, description, base_servings, prep_time, cook_time, tags,
        raw_ingredients, parsed_ingredients, instructions, plating, tips,
        image_path, external_image_url, created_by, updated_by
      ) VALUES (
        ${recipe.title},
        ${recipe.description || ""},
        ${recipe.base_servings || 2},
        ${recipe.prep_time || 0},
        ${recipe.cook_time || 0},
        ${recipe.tags || []},
        ${recipe.raw_ingredients},
        ${JSON.stringify(recipe.parsed_ingredients || [])},
        ${recipe.instructions},
        ${recipe.plating || ""},
        ${recipe.tips || ""},
        ${null},
        ${null},
        ${createdBy},
        ${createdBy}
      ) RETURNING id, title
    `;

    await sql.end();

    return new Response(
      JSON.stringify({ success: true, recipe: { id: result[0].id, title: result[0].title } }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (error) {
    await sql.end();
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
