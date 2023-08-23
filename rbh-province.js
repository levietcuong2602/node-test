const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const mysql = require("mysql");

const readCustomerFromCsv = async () => {
  const filePath = path.join(__dirname, "./Thailand-Province.xlsx");

  const workbook = XLSX.readFile(filePath);
  const sheet_name_list = workbook.SheetNames;
  const provincesData = XLSX.utils.sheet_to_json(
    workbook.Sheets[sheet_name_list[0]]
  );

  const results = {};
  for (const row of provincesData) {
    // master provinces
    const provinceEng = row["ProvinceEng"].toUpperCase();
    if (!results[provinceEng]) {
      results[provinceEng] = { districts: {} };
    }
    results[provinceEng].name_th = row["ProvinceThai"];
    results[provinceEng].code = row["ProvinceID"];
    results[provinceEng].geography = row["ภูมิภาคอย่างเป็นทางการ"];

    // master districts
    const districtEng = row["DistrictEng"].toUpperCase();
    if (!results[provinceEng].districts[districtEng]) {
      results[provinceEng].districts[districtEng] = { sub_districts: {} };
    }

    results[provinceEng].districts[districtEng].name_th = row["DistrictThai"];
    results[provinceEng].districts[districtEng].id = row["DistrictID"];

    // master sub districts
    const tambonEng = row["TambonEng"].toUpperCase();
    if (!results[provinceEng].districts[districtEng].sub_districts[tambonEng]) {
      results[provinceEng].districts[districtEng].sub_districts[tambonEng] = {};
    }

    results[provinceEng].districts[districtEng].sub_districts[tambonEng].id =
      row["TambonID"];
    results[provinceEng].districts[districtEng].sub_districts[
      tambonEng
    ].name_th = row["TambonThai"];
    results[provinceEng].districts[districtEng].sub_districts[
      tambonEng
    ].district_id = row["DistrictID"];

    // master postal
    results[provinceEng].districts[districtEng].sub_districts[
      tambonEng
    ].postal_code = row["PostCodeAll"].split("/");
  }

  console.log(`Total Provinces: ${Object.keys(results).length}`);
  fs.writeFileSync(
    "./provinces.json",
    JSON.stringify(
      Object.keys(results).map((province) => ({
        name_en: province,
        name_th: results[province].name_th,
        code: results[province].code,
        geography: results[province].geography,
        districts: Object.keys(results[province].districts).map((district) => ({
          name_en: district,
          name_th: results[province].districts[district].name_th,
          id: +results[province].districts[district].id,
          sub_districts: Object.keys(
            results[province].districts[district].sub_districts
          ).map((e) => ({
            id: results[province].districts[district].sub_districts[e].id,
            name_en: e,
            name_th:
              results[province].districts[district].sub_districts[e].name_th,
            district_id:
              +results[province].districts[district].sub_districts[e]
                .district_id,
            postal_code:
              results[province].districts[district].sub_districts[e]
                .postal_code,
          })),
        })),
      })),
      null,
      2
    )
  );
};

readCustomerFromCsv();

const check = async () => {
  let connection = mysql.createConnection({
    host: "localhost",
    user: "root",
    port: 3307,
    password: "password",
    database: "rbh-ride-hailing-driver-sit",
  });
  connection.connect(function (err) {
    if (err) {
      return console.error("error: " + err.message);
    }

    console.log("Connected to the MySQL server.");
  });

  const provinces = require("./provinces.json");
  for (const row of provinces) {
    const matches = await execQuery(
      connection,
      `SELECT * from master_provinces WHERE code = '${row.code}'`
    );

    if (!matches.length) console.log(`${row.name_en}`);

    // console.log(`${row.name_en} existed`);
  }

  connection.end();
};

const execQuery = (connection, query) =>
  new Promise((res, rej) => {
    connection.query(query, function (error, results, fields) {
      if (error) rej(error);

      res(results);
    });
  });

// check();
