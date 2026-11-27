// Purpose: Webpack configuration for the project

const entry = {
    ["cookie-policy"]: "./static/js/cookie-policy.js",
    ["navigation"]: "./static/js/navigation.js",
    ["tabs"]: "./static/js/typeface-tabs.js",
  };
  

const development = process.env.DEVEL;

module.exports = {
  entry: entry,
  output: {
    filename: "[name].js",
    path: __dirname + "/static/js/dist",
  },
  mode: development ? "development" : "production",
  devtool: development ? "eval-source-map" : "source-map",
};
