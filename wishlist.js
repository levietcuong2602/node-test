const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const axios = require("axios");
const url = require("url");

let token = `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJaVjJZTU5kZGpCTHU1OWJ4Um9KNFU4NnlEY3ZnNUpKd19Lb0lwRnlJUU5vIn0.eyJleHAiOjE2ODU5Nzk4MzIsImlhdCI6MTY4NTk2MTgzMiwianRpIjoiZTI0NWIwMjEtNzVhYS00ZjNjLWE2MWEtNzY4ZTFmZmNhNWYzIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy9tci1wb29sbWFuIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjQ4YjRiM2IzLTE1NDQtNGU4MC04NTkxLWI0NzFkYmFjNzM0OCIsInR5cCI6IkJlYXJlciIsImF6cCI6InR3Y19hZG1pbiIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9jb25zb2xlLmF1LWF3cy50aGV3aXNobGlzdC5pbyIsImh0dHBzOi8vYXBpLmF1LWF3cy50aGV3aXNobGlzdC5pbyJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoiZW1haWwgcHJvZmlsZSIsImNsaWVudElkIjoidHdjX2FkbWluIiwiY2xpZW50SG9zdCI6IjE5Mi4xNjguMTMzLjIwIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJzZXJ2aWNlLWFjY291bnQtdHdjX2FkbWluIiwiY2xpZW50QWRkcmVzcyI6IjE5Mi4xNjguMTMzLjIwIn0.JUFgbzri8A70cOG1dL6CgO5KRvmsj4JUlSdDVL-qVZ-gmqDQwFYhBu9cc4ojLQmXB8PB6qfF_LUBrpPt3GiAGLygCuN83gf2Vw8MEwbaahCHvt3MOjhPyCIp41oQ5XPsX-MWHNObuvgB7_2JI8IzukNkhnrgCmxjlJuuUZ8yY0FNksgp3euex5OmQXpokAbqsurjySUXIACXE667F-cedrFKX6OyUn-5xbVe4VyzwWBFZrV8D2BJ77-igP8TQO8AMmS8ysxPvuCipefkt4qd_W_QeQvOI6IirEUHelsJRY9NJ2973fi8q2LgkyrsBJWlLruFKULgj4d0dyEdVA8sbg`;
const results = {};

const RATE_LIMIT_TWC = 15;
const TENANT_ID = "mr-poolman";
const TENANT_SECRET = "gLkyfic0IwiDbGjLHe1VHk";
const ENV_TWC = "aws";

const readFileCsv = async () => {
  const filePath = path.join(__dirname, "./variants/product-variant-shona.csv");
  const workbook = XLSX.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const variants = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheet_name_list[0]]
  );

  const countVariant = variants.length;
  let index = 0;

  const variantChunks = chunk(variants, RATE_LIMIT_TWC);
  for (const variantChunk of variantChunks) {
    console.log(
      `Checking product variant - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countVariant}`
    );

    await Promise.all(
      variantChunk.map((variant) =>
        checkProductVariantInTWC(variant, TENANT_ID)
      )
    );

    await new Promise((rs) => setTimeout(rs, 500));

    index++;
  }

  // for (const variant of variants) {
  //   const { product_id, variant_id } = variant;
  //   console.log(
  //     `Checking product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
  //   );
  //   await checkProductVariantInTWC(variant, TENANT_ID);
  // }

  console.log(`Total length variant not sync: ${Object.keys(results).length}`);
  fs.writeFileSync("./shona-joy-dev.json", JSON.stringify(results, null, 2));
};

const getAccessToken = async ({ tenant_id, client_secret }) => {
  try {
    const { status, data } = await axios({
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      url: `https://auth.au-${ENV_TWC}.thewishlist.io/auth/realms/${tenant_id}/protocol/openid-connect/token`,
      data: `client_id=${encodeURIComponent(
        "twc_admin"
      )}&client_secret=${encodeURIComponent(
        client_secret
      )}&grant_type=${encodeURIComponent("client_credentials")}`,
    });

    if (status === 200) {
      token = data.access_token;
      console.log(data.access_token);
    }
  } catch (err) {
    console.log("Get Token Err: ", err.message);
  }
};

const checkProductVariantInTWC = async (
  { product_id, variant_id, payload },
  tenant_id
) => {
  let index = 0;
  let totalRetries = 3;
  for (index = 0; index < totalRetries; index++) {
    try {
      const { status } = await axios({
        method: "GET",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-aws.thewishlist.io/services/shopifyconnect/api/products/${product_id}/variants/${variant_id}`,
      });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log("ERR:", err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(
      `ERR: product: ${product_id} variant ${variant_id} - index retries: ${index}`
    );
    results[variant_id] = payload;
    return false;
  }
};

const restoreProductVariants = async () => {
  const variantJSON = require(path.join(__dirname, "./shona-joy-dev.json"));
  const variants = Object.values(variantJSON).map((e) => JSON.parse(e));
  const variantChunks = chunk(variants, RATE_LIMIT_TWC);

  const countVariant = variants.length;
  let index = 0;
  // for (const vChunk of variantChunks) {
  //   console.log(
  //     `Create product variant - index: ${
  //       index * RATE_LIMIT_TWC + 1
  //     }/${countVariant}`
  //   );
  //   await Promise.all(vChunk.map((variant) => saveProductVariantTWC(variant)));
  // }

  for (const variant of variants) {
    const { product_id, id: variant_id } = variant;
    console.log(
      `Create product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
    );
    await saveProductVariantTWC(variant, TENANT_ID);
  }
};

const saveProductVariantTWC = async (variant, tenant_id) => {
  let index = 0;
  let totalRetries = 3;
  const { product_id, id: variant_id } = variant;

  for (index = 0; index < totalRetries; index++) {
    try {
      const isExist = await checkProductVariantInTWC(
        {
          product_id,
          variant_id,
        },
        TENANT_ID
      );
      if (isExist) {
        console.log(`Product: ${product_id} variant ${variant_id} is exists`);
        return false;
      }

      const { status, data } = await axios({
        method: "POST",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-${ENV_TWC}.thewishlist.io/services/shopifyconnect/api/products/variants`,
        data: variant,
      });
      // console.log({
      //   status,
      //   data,
      //   variant,
      // });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log("Save Variant ERR:", err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(
      `ERR: Create product: ${product_id} variant ${variant_id} failed`
    );
    return false;
  }
};

// readFileCsv();
// restoreProductVariants();

// getAccessToken({
//   tenant_id: TENANT_ID,
//   client_secret: TENANT_SECRET,
// });

const findPageInfoSubmatch = (text = "") => {
  var textRegex = /^([\w]+)\>; rel="(previous|next)"$/;
  return text.match(textRegex);
};

// getListOrderFromShopify();
