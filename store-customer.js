const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const axios = require("axios");
const url = require("url");

const { chunk, sleep } = require("./utils/util");

let token = `eyJhbGciOiJSUzI1NiIsInR5cCIgOiAiSldUIiwia2lkIiA6ICJaVjJZTU5kZGpCTHU1OWJ4Um9KNFU4NnlEY3ZnNUpKd19Lb0lwRnlJUU5vIn0.eyJleHAiOjE2ODU5Nzk4MzIsImlhdCI6MTY4NTk2MTgzMiwianRpIjoiZTI0NWIwMjEtNzVhYS00ZjNjLWE2MWEtNzY4ZTFmZmNhNWYzIiwiaXNzIjoiaHR0cHM6Ly9hdXRoLmF1LWF3cy50aGV3aXNobGlzdC5pby9hdXRoL3JlYWxtcy9tci1wb29sbWFuIiwiYXVkIjoiYWNjb3VudCIsInN1YiI6IjQ4YjRiM2IzLTE1NDQtNGU4MC04NTkxLWI0NzFkYmFjNzM0OCIsInR5cCI6IkJlYXJlciIsImF6cCI6InR3Y19hZG1pbiIsImFjciI6IjEiLCJhbGxvd2VkLW9yaWdpbnMiOlsiaHR0cHM6Ly9jb25zb2xlLmF1LWF3cy50aGV3aXNobGlzdC5pbyIsImh0dHBzOi8vYXBpLmF1LWF3cy50aGV3aXNobGlzdC5pbyJdLCJyZWFsbV9hY2Nlc3MiOnsicm9sZXMiOlsib2ZmbGluZV9hY2Nlc3MiLCJ1bWFfYXV0aG9yaXphdGlvbiJdfSwicmVzb3VyY2VfYWNjZXNzIjp7ImFjY291bnQiOnsicm9sZXMiOlsibWFuYWdlLWFjY291bnQiLCJtYW5hZ2UtYWNjb3VudC1saW5rcyIsInZpZXctcHJvZmlsZSJdfX0sInNjb3BlIjoiZW1haWwgcHJvZmlsZSIsImNsaWVudElkIjoidHdjX2FkbWluIiwiY2xpZW50SG9zdCI6IjE5Mi4xNjguMTMzLjIwIiwiZW1haWxfdmVyaWZpZWQiOmZhbHNlLCJwcmVmZXJyZWRfdXNlcm5hbWUiOiJzZXJ2aWNlLWFjY291bnQtdHdjX2FkbWluIiwiY2xpZW50QWRkcmVzcyI6IjE5Mi4xNjguMTMzLjIwIn0.JUFgbzri8A70cOG1dL6CgO5KRvmsj4JUlSdDVL-qVZ-gmqDQwFYhBu9cc4ojLQmXB8PB6qfF_LUBrpPt3GiAGLygCuN83gf2Vw8MEwbaahCHvt3MOjhPyCIp41oQ5XPsX-MWHNObuvgB7_2JI8IzukNkhnrgCmxjlJuuUZ8yY0FNksgp3euex5OmQXpokAbqsurjySUXIACXE667F-cedrFKX6OyUn-5xbVe4VyzwWBFZrV8D2BJ77-igP8TQO8AMmS8ysxPvuCipefkt4qd_W_QeQvOI6IirEUHelsJRY9NJ2973fi8q2LgkyrsBJWlLruFKULgj4d0dyEdVA8sbg`;
const results = {};

const RATE_LIMIT_TWC = 15;
const TENANT_ID = "mr-poolman";
const TENANT_SECRET = "gLkyfic0IwiDbGjLHe1VHk";
const ENV_TWC = "aws";

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

const getListOrderFromShopify = async () => {
  try {
    const params = {
      limit: 6,
    };
    while (true) {
      console.log(JSON.stringify(params));
      const {
        headers: { link },
        data: { orders = [] },
      } = await axios({
        url: "https://sosctest148.myshopify.com/admin/api/2023-04/orders.json",
        params,
        headers: {
          "X-Shopify-Access-Token": "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",
        },
      });
      console.log("length: ", orders.length);
      console.log("link: ", link);
      if (!link) break;

      let newPageInfo = params.page_info;
      link.split(",").forEach((linkEl) => {
        const {
          query: { page_info: pageInfo },
        } = url.parse(linkEl, true);
        const matches = findPageInfoSubmatch(pageInfo.trim());
        if (matches[2] == "next") {
          newPageInfo = matches[1];
        }
      });
      if (newPageInfo === params.page_info) break;
      params.page_info = newPageInfo;
      await sleep(5000);
    }
  } catch (err) {
    console.log("ERR: ", err.message);
  }
};

const checkCustomerInTWC = async (customer, tenant_id) => {
  const { customer_id, payload } = customer;
  let index = 0;
  let totalRetries = 10;
  for (index = 0; index < totalRetries; index++) {
    try {
      const { status } = await axios({
        method: "GET",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-aws.thewishlist.io/services/shopifyconnect/api/customers/${customer_id}`,
      });
      if (status === 200) {
        return true;
      }
      await sleep(300);
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
    console.log(`ERR: customer ${customer_id} - index retries: ${index}`);
    results[customer_id] = payload;
  }
};

const readCustomerFromCsv = async () => {
  const filePath = path.join(
    __dirname,
    "./mr-poolman-missing-customer-retry-7.json"
  );

  // const workbook = XLSX.readFile(filePath);
  // const sheet_name_list = workbook.SheetNames;
  // const customers = XLSX.utils.sheet_to_json(
  //   workbook.Sheets[sheet_name_list[0]]
  // );
  const customerData = require(filePath);
  const customers = Object.keys(customerData).map((customer_id) => ({
    customer_id,
    payload: customers[customer_id],
  }));
  const countCustomer = customers.length;
  let index = 0;

  const customerChunks = chunk(customers, RATE_LIMIT_TWC);
  for (const customerChunk of customerChunks) {
    console.log(
      `Checking customer - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countCustomer}`
    );

    await Promise.all(
      customerChunk.map((customer) => checkCustomerInTWC(customer, TENANT_ID))
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

  console.log(`Total length customer not sync: ${Object.keys(results).length}`);
  fs.writeFileSync(
    "./mr-poolman-missing-customer-retry-7.json",
    JSON.stringify(results, null, 2)
  );
};

// readCustomerFromCsv();

const restoreCustomers = async () => {
  const customerObj = require(path.join(
    __dirname,
    "./customers/mr-poolman-missing-customer-retry-7.json"
  ));
  const customers = Object.values(customerObj)
    .map((e) => JSON.parse(e))
    .map(({ email, ...rest }) => ({
      email: email && email.toLowerCase(),
      ...rest,
    }))
    .map((e) => convertCustomer(e));
  const customerChunks = chunk(customers, RATE_LIMIT_TWC);

  const countCustomers = customers.length;
  let index = 0;
  for (const vChunk of customerChunks) {
    console.log(
      `upload customers - index: ${
        index * RATE_LIMIT_TWC + 1
      }/${countCustomers}`
    );
    await Promise.all(vChunk.map((customer) => uploadCustomerTWC(customer)));
    await sleep(500);
    index++;
  }

  // for (const variant of customerChunks) {
  //   console.log(
  //     `Create product: ${product_id} variant ${variant_id} - index: ${++index}/${countVariant}`
  //   );
  //   await saveProductVariantTWC(variant, TENANT_ID);
  // }

  console.log(`Total length customer not sync: ${Object.keys(results).length}`);
  fs.writeFileSync(
    "./customers/mr-poolman-missing-customer-after-restore-1.json",
    JSON.stringify(results, null, 2)
  );
};

const uploadCustomerTWC = async (customer, tenant_id = TENANT_ID) => {
  let index = 0;
  let totalRetries = 3;
  const { id: customer_id } = customer;

  for (index = 0; index < totalRetries; index++) {
    try {
      const isExist = await checkCustomerInTWC(
        {
          customer_id,
          payload: customer,
        },
        TENANT_ID
      );
      if (isExist) {
        console.log(`Customer ${customer_id} is exists`);
        return false;
      }

      const { status, data } = await axios({
        method: "POST",
        headers: {
          "X-TWC-Tenant": tenant_id,
          Authorization: `Bearer ${token}`,
        },
        url: `https://api.au-${ENV_TWC}.thewishlist.io/services/shopifyconnect/api/customers`,
        data: customer,
      });
      if (status === 200) {
        return true;
      }
    } catch (err) {
      console.log("Save Customer ERR:", err.message);
      if (err.response?.status === 401) {
        await getAccessToken({
          tenant_id: TENANT_ID,
          client_secret: TENANT_SECRET,
        });
      }
    }
  }

  if (index === totalRetries) {
    console.log(JSON.stringify(customer));
    console.log(`ERR: create customers: ${customer_id} failed`);
    results[customer_id] = customer;
    return false;
  }
};

const convertCustomer = (customer) => {
  const {
    id,
    last_order_id,
    email,
    created_at,
    updated_at,
    accepts_marketing_updated_at,
    addresses = [],
    default_address,
    total_spent,
  } = customer;

  const newCustomer = {
    ...customer,
    id: `${id}`,
    last_order_id: `${last_order_id}`,
    created_at: new Date(created_at).toISOString(),
    updated_at: new Date(updated_at).toISOString(),
    total_spent: +total_spent,
    accepts_marketing_updated_at: new Date(
      accepts_marketing_updated_at
    ).toISOString(),
  };

  if (default_address) {
    newCustomer.default_address = {
      ...default_address,
      email,
      id: `${default_address.id}`,
      customer_id: `${default_address.customer_id}`,
    };
  }
  if (addresses) {
    newCustomer.addresses = addresses.map((addr) => ({
      ...addr,
      email,
      id: `${addr.id}`,
      customer_id: `${addr.customer_id}`,
    }));
  }

  return newCustomer;
};

restoreCustomers();
// console.log(
//   JSON.stringify(
//     convertCustomer({
//       email: "ian@growthaustralia.com.au",
//       id: 949077246009,
//       note: "Sales Channel: Checkout",
//       phone: "+61456229109",
//       state: "disabled",
//       currency: "AUD",
//       addresses: [
//         {
//           id: 1036602277945,
//           zip: "4017",
//           city: "BRACKEN RIDGE",
//           name: "Ian Gilmour",
//           phone: "+61-456229109",
//           country: "Australia",
//           default: true,
//           address1: "3 Michael Place",
//           province: "Queensland",
//           last_name: "Gilmour",
//           first_name: "Ian",
//           customer_id: 949077246009,
//           country_code: "AU",
//           country_name: "Australia",
//           province_code: "QLD",
//         },
//       ],
//       last_name: "Gilmour",
//       created_at: "2018-09-21T12:29:24+10:00",
//       first_name: "Ian",
//       updated_at: "2023-01-24T05:18:22+11:00",
//       total_spent: "69.99",
//       orders_count: 1,
//       last_order_id: 757230960697,
//       verified_email: true,
//       default_address: {
//         id: 1036602277945,
//         zip: "4017",
//         city: "BRACKEN RIDGE",
//         name: "Ian Gilmour",
//         phone: "+61-456229109",
//         country: "Australia",
//         default: true,
//         address1: "3 Michael Place",
//         province: "Queensland",
//         last_name: "Gilmour",
//         first_name: "Ian",
//         customer_id: 949077246009,
//         country_code: "AU",
//         country_name: "Australia",
//         province_code: "QLD",
//       },
//       last_order_name: "N1071713",
//       admin_graphql_api_id: "gid://shopify/Customer/949077246009",
//       accepts_marketing_updated_at: "2019-01-04T23:31:11+11:00",
//     })
//   )
// );
