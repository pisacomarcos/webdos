var ve=Object.defineProperty;var s=(e,t)=>ve(e,"name",{value:t,configurable:!0}),S=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(t,o)=>(typeof require<"u"?require:t)[o]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw new Error('Dynamic require of "'+e+'" is not supported')});var V=["/products","/products/:id","/product-categories","/product-categories","/orders","/orders/:id","/customers","/customers/:id","/customers/groups","/customers/groups/:id","/discounts","/discounts/new","/discounts/:id","/gift-cards","/gift-cards/:id","/gift-cards/manage","/pricing","/pricing/new","/pricing/:id","/inventory","/collections","/collections/:id","/draft-orders","/draft-orders/:id","/login","/sales-channels","/publishable-api-keys","/oauth","/oauth/:app_name"];var N=["order.details.before","order.details.after","order.list.before","order.list.after","draft_order.list.before","draft_order.list.after","draft_order.details.before","draft_order.details.after","customer.details.before","customer.details.after","customer.list.before","customer.list.after","customer_group.details.before","customer_group.details.after","customer_group.list.before","customer_group.list.after","product.details.before","product.details.after","product.list.before","product.list.after","product_collection.details.before","product_collection.details.after","product_collection.list.before","product_collection.list.after","price_list.details.before","price_list.details.after","price_list.list.before","price_list.list.after","discount.details.before","discount.details.after","discount.list.before","discount.list.after","gift_card.details.before","gift_card.details.after","gift_card.list.before","gift_card.list.after","custom_gift_card.before","custom_gift_card.after","login.before","login.after"];import Z from"node:path";import Xe from"webpack";import We from"fs-extra";import B from"node:path";import H from"fs-extra";function P(e){return!(H.lstatSync(e).isDirectory()&&e.includes("__test__")||H.lstatSync(e).isFile()&&(e.includes(".test")||e.includes(".spec")||e.includes("webpack.config")))}s(P,"copyFilter");import E from"fs-extra";import m from"node:path";import I from"ts-dedent";import b from"picocolors";import Q from"readline";var O="[@medusajs/admin]";function we(){let e=process.stdout.rows-2,t=e>0?`
`.repeat(e):"";console.log(t),Q.cursorTo(process.stdout,0,0),Q.clearScreenDown(process.stdout)}s(we,"clearScreen");var xe=process.stdout.isTTY&&!process.env.CI,be=xe?we:()=>{};function Ee(){let e=s((t,o,r)=>{let n=t==="info"?"log":t,a=s(()=>{let i=t==="info"?b.cyan(b.bold(O)):t==="warn"?b.yellow(b.bold(O)):b.red(b.bold(O));return`${b.dim(new Date().toLocaleTimeString())} ${i} ${o}`},"format");r!=null&&r.clearScreen&&be(),console[n](a()),r!=null&&r.error&&console.error(r.error)},"output");return{info:(t,o)=>e("info",t,o),warn:(t,o)=>e("warn",t,o),error:(t,o)=>e("error",t,o),panic:(t,o)=>{e("error",t,o),e("error","Exiting process",{}),process.exit(1)}}}s(Ee,"createLogger");var c=Ee();function v(e){let o=process.platform==="win32"?"\\":"/",r=new RegExp(`\\${o}`,"g");return e.replace(r,"/")}s(v,"normalizePath");import{parse as U}from"@babel/parser";import j from"@babel/traverse";import g from"fs-extra";import _ from"path";function Y(e){return N.includes(e)}s(Y,"isValidInjectionZone");function $e(e){let t=e.find(r=>r.type==="ObjectProperty"&&r.key.type==="Identifier"&&r.key.name==="zone");if(!t)return!1;let o=!1;return t.value.type==="StringLiteral"?o=Y(t.value.value):t.value.type==="ArrayExpression"&&(o=t.value.elements.every(r=>r.type==="StringLiteral"&&Y(r.value))),o}s($e,"validateWidgetConfigExport");function Se(e){let t=e.find(n=>n.type==="ObjectProperty"&&n.key.type==="Identifier"&&n.key.name==="link");if(!t)return!0;let o=t.value,r=!1;return o.properties.some(n=>n.type==="ObjectProperty"&&n.key.type==="Identifier"&&n.key.name==="label"&&n.value.type==="StringLiteral")&&(r=!0),r}s(Se,"validateRouteConfigExport");function je(e){let t=e.find(a=>a.type==="ObjectProperty"&&a.key.type==="Identifier"&&a.key.name==="card");if(!t)return!1;let o=t.value,r=!1,n=!1;return o.properties.some(a=>a.type==="ObjectProperty"&&a.key.type==="Identifier"&&a.key.name==="label"&&a.value.type==="StringLiteral")&&(r=!0),o.properties.some(a=>a.type==="ObjectProperty"&&a.key.type==="Identifier"&&a.key.name==="description"&&a.value.type==="StringLiteral")&&(n=!0),r&&n}s(je,"validateSettingConfigExport");function z(e,t){let o=!1,r=e.node.declaration;if(r&&r.type==="VariableDeclaration"){let n=r.declarations.find(a=>a.type==="VariableDeclarator"&&a.id.type==="Identifier"&&a.id.name==="config");if(n&&n.init.type==="ObjectExpression"){let a=n.init.properties;t==="widget"&&(o=$e(a)),t==="route"&&(o=Se(a)),t==="setting"&&(o=je(a))}else o=!1}return o}s(z,"validateConfigExport");function M(e,t){let o=!1,r=e.node.declaration;if(r&&(r.type==="Identifier"||r.type==="FunctionDeclaration")){let n=r.type==="Identifier"?r.name:r.id&&r.id.name;if(n)try{j(t,{VariableDeclarator({node:a,scope:i}){let d=!1;a.id.type==="Identifier"&&a.id.name===n&&(d=!0),d&&j(a,{ReturnStatement(f){var u,l;(((u=f.node.argument)==null?void 0:u.type)==="JSXElement"||((l=f.node.argument)==null?void 0:l.type)==="JSXFragment")&&(o=!0)}},i)}})}catch(a){return c.error(`There was an error while validating the default export of ${e}. The following error must be resolved before continuing:`,{error:a}),!1}}return o}s(M,"validateDefaultExport");async function ee(e){let t=await g.readFile(e,"utf-8"),o={sourceType:"module",plugins:["jsx"]};(e.endsWith(".ts")||e.endsWith(".tsx"))&&o.plugins.push("typescript");let r;try{r=U(t,o)}catch(i){return c.error(`An error occurred while parsing the Widget "${e}", and the Widget cannot be injected. The following error must be resolved before continuing:`,{error:i}),!1}let n=!1,a=!1;try{j(r,{ExportDefaultDeclaration:i=>{a=M(i,r)},ExportNamedDeclaration:i=>{n=z(i,"widget")}})}catch(i){return c.error(`An error occurred while validating the Widget "${e}". The following error must be resolved before continuing:`,{error:i}),!1}return n&&!a&&(a||c.error(`The default export in the Widget "${e}" is invalid and the widget will not be injected. Please make sure that the default export is a valid React component.`)),!n&&a&&c.error(`The Widget config export in "${e}" is invalid and the Widget cannot be injected. Please ensure that the config is valid.`),n&&a}s(ee,"validateWidget");function te(e){let t=v(e),o=/\[(.*?)\]/g;return t.replace(o,":$1").replace(/\/page\.[jt]sx?$/i,"")}s(te,"createPath");function ke(e){return V.includes(e)}s(ke,"isForbiddenRoute");function re(e,t){if(ke(e))return{error:`A route from ${t} is using a forbidden path: ${e}.`,valid:!1};let o=["/",":","-"];for(let r=0;r<e.length;r++){let n=e[r];if(!o.includes(n)&&!/^[a-z0-9]$/i.test(n))return{error:`A route from ${t} is using an invalid path: ${e}. Only alphanumeric characters, "/", ":", and "-" are allowed.`,valid:!1};if(n===":"&&(r===0||e[r-1]!=="/"))return{error:`A route from ${t} is using an invalid path: ${e}. All dynamic segments must be preceded by a "/".`,valid:!1}}return{valid:!0,error:""}}s(re,"validatePath");async function oe(e,t){let o=te(e.replace(t,"")),{valid:r,error:n}=re(o,e);if(!r)return c.error(`The path ${o} for the UI Route "${e}" is invalid and the route cannot be injected. The following error must be fixed before the route can be injected: ${n}`),null;let a=await g.readFile(e,"utf-8"),i=!1,d=!1,f={sourceType:"module",plugins:["jsx"]};(e.endsWith(".ts")||e.endsWith(".tsx"))&&f.plugins.push("typescript");let u;try{u=U(a,f)}catch(l){return c.error(`An error occurred while parsing the UI Route "${e}", and the UI Route cannot be injected. The following error must be resolved before continuing:`,{error:l}),null}try{j(u,{ExportDefaultDeclaration:l=>{i=M(l,u)},ExportNamedDeclaration:l=>{d=z(l,"route")}})}catch(l){return c.error(`An error occurred while validating the UI Route "${e}", and the UI Route cannot be injected. The following error must be resolved before continuing:`,{error:l}),null}return i?{path:o,hasConfig:d,file:e}:(c.error(`The default export in the UI Route "${e}" is invalid and the route cannot be injected. Please make sure that the default export is a valid React component.`),null)}s(oe,"validateRoute");async function ne(e,t){let o=te(e.replace(t,"")),{valid:r,error:n}=re(o,e);if(!r)return c.error(`The path ${o} for the Setting "${e}" is invalid and the setting cannot be injected. The following error must be fixed before the Setting can be injected: ${n}`),null;let a=await g.readFile(e,"utf-8"),i=!1,d=!1,f={sourceType:"module",plugins:["jsx"]};(e.endsWith(".ts")||e.endsWith(".tsx"))&&f.plugins.push("typescript");let u;try{u=U(a,f)}catch(l){return c.error(`
      An error occured while parsing the Setting "${e}". The following error must be resolved before continuing:
      `,{error:l}),null}try{j(u,{ExportDefaultDeclaration:l=>{i=M(l,u)},ExportNamedDeclaration:l=>{d=z(l,"setting")}})}catch(l){return c.error(`
      An error occured while validating the Setting "${e}". The following error must be resolved before continuing:`,{error:l}),null}return i?d?{path:o,file:e}:(c.error(`The named export "config" in the Setting "${e}" is invalid or missing and the settings page will not be injected. Please make sure that the file exports a valid config.`),null):(c.error(`The default export in the Setting "${e}" is invalid and the page will not be injected. Please make sure that the default export is a valid React component.`),null)}s(ne,"validateSetting");async function D(e){let t=[];if(!await g.pathExists(e))return[];let r=await g.readdir(e),n=!1;for(let i of r){let d=_.join(e,i);if((await g.stat(d)).isDirectory()){let u=await g.readdir(d);for(let l of u){let y=_.join(e,i,l),x=await g.stat(y);if(x.isFile()&&/^(.*\/)?page\.[jt]sx?$/i.test(l)){t.push(y);break}else x.isDirectory()&&(n=!0)}}}return n&&c.warn(`The directory ${e} contains subdirectories. Settings do not support nested routes, only UI Routes support nested paths.`),(await Promise.all(t.map(async i=>ne(i,e)))).filter(i=>i!==null)}s(D,"findAllValidSettings");async function W(e){let t=[];if(!await g.pathExists(e))return[];async function r(i){let d=await g.readdir(i);for(let f of d){let u=_.join(i,f),l=await g.stat(u);l.isDirectory()?await r(u):l.isFile()&&/\.(js|jsx|ts|tsx)$/i.test(f)&&t.push(u)}}s(r,"traverseDirectory"),await r(e);let n=t.map(i=>ee(i)?i:null);return(await Promise.all(n)).filter(i=>i!==null)}s(W,"findAllValidWidgets");async function F(e){let t=[];if(!await g.pathExists(e))return[];async function r(i){let d=await g.readdir(i);for(let f of d){let u=_.join(i,f),l=await g.stat(u);l.isDirectory()?await r(u):l.isFile()&&/^(.*\/)?page\.[jt]sx?$/i.test(f)&&t.push(u)}}s(r,"traverseDirectory"),await r(e);let n=t.map(async i=>oe(i,e));return(await Promise.all(n)).filter(i=>i!==null)}s(F,"findAllValidRoutes");var T=/\.[^/.]+$/;async function Ce(e,t){try{await E.copy(e,t,{filter:P})}catch(o){return c.error("Could not copy local extensions to cache folder. See the error below for details:",{error:o}),!1}return!0}s(Ce,"copyLocalExtensions");async function Ae(e,t){let o=m.resolve(e,"src","admin");if(!await E.pathExists(o))return!1;if(!await Ce(o,m.resolve(t,"admin","src","extensions")))return c.error("Could not copy local extensions to cache folder. See above error for details. The error must be fixed before any local extensions can be injected."),!1;let[a,i,d]=await Promise.all([W(m.resolve(t,"admin","src","extensions","widgets")),F(m.resolve(t,"admin","src","extensions","routes")),D(m.resolve(t,"admin","src","extensions","settings"))]),f=a.map((p,h)=>{let w=v(m.relative(m.resolve(t,"admin","src","extensions"),p).replace(T,""));return{importStatement:`import Widget${h}, { config as widgetConfig${h} } from "./${w}"`,extension:`{ Component: Widget${h}, config: { ...widgetConfig${h}, type: "widget" } }`}}),u=i.map((p,h)=>{let w=v(m.relative(m.resolve(t,"admin","src","extensions"),p.file).replace(T,"")),ge=p.hasConfig?`import Page${h}, { config as routeConfig${h} } from "./${w}"`:`import Page${h} from "./${w}"`,ye=p.hasConfig?`{ Component: Page${h}, config: { ...routeConfig${h}, type: "route",  path: "${p.path}" } }`:`{ Component: Page${h}, config: { path: "${p.path}", type: "route" } }`;return{importStatement:ge,extension:ye}}),l=d.map((p,h)=>{let w=v(m.relative(m.resolve(t,"admin","src","extensions"),p.file).replace(T,""));return{importStatement:`import Setting${h}, { config as settingConfig${h} } from "./${w}"`,extension:`{ Component: Setting${h}, config: { ...settingConfig${h}, path: "${p.path}", type: "setting" } }`}}),y=[...f,...u,...l],x=I`
    ${y.map(p=>p.importStatement).join(`
`)}

    const LocalEntry = {
      identifier: "local",
      extensions: [
        ${y.map(p=>p.extension).join(`,
`)}
      ],
    }

    export default LocalEntry
  `;try{await E.outputFile(m.resolve(t,"admin","src","extensions","_local-entry.ts"),x)}catch(p){c.panic("Failed to write the entry file for the local extensions. See the error below for details:",{error:p})}return!0}s(Ae,"createLocalExtensionsEntry");function Pe(e){let t=[];for(let o of e)try{let r=m.dirname(S.resolve(`${o}/package.json`,{paths:[process.cwd()]})),n=m.resolve(r,"dist","admin","_virtual_entry.js");E.existsSync(n)&&t.push(n)}catch{c.warn(`There was an error while attempting to load extensions from the plugin: ${o}. Are you sure it is installed?`)}return t}s(Pe,"findPluginsWithExtensions");async function _e(e,t){let o=I`
    const path = require("path")

    const devPath = path.join(__dirname, "..", "..", "src/admin/**/*.{js,jsx,ts,tsx}")

    module.exports = {
      content: [
        devPath,
        ${t.map(r=>`"${v(m.relative(m.resolve(e,"admin"),m.dirname(m.join(r,"..",".."))))}/dist/admin/**/*.{js,jsx,ts,tsx}"`).join(`,
`)}
      ],
    }
  
  `;try{await E.outputFile(m.resolve(e,"admin","tailwind.content.js"),o)}catch{c.warn(`Failed to write the Tailwind content file to ${e}. The admin UI will remain functional, but CSS classes applied to extensions from plugins might not have the correct styles`)}}s(_e,"writeTailwindContentFile");async function De(e,t,o){if(!t.length&&!o){let i=I`
      const extensions = []

      export default extensions
    `;try{await E.outputFile(m.resolve(e,"admin","src","extensions","_main-entry.ts"),i)}catch(d){c.panic("Failed to write the entry file for the main extensions. See the error below for details:",{error:d})}return}let n=[...t.map(i=>v(m.relative(m.resolve(e,"admin","src","extensions"),i).replace(T,""))).map((i,d)=>({importStatement:`import Plugin${d} from "${i}"`,extension:`Plugin${d}`})),...o?[{importStatement:'import LocalEntry from "./_local-entry"',extension:"LocalEntry"}]:[]],a=I`
      ${n.map(i=>i.importStatement).join(`
`)}

      const extensions = [
        ${n.map(i=>i.extension).join(`,
`)}
      ]

      export default extensions
    `;try{await E.outputFile(m.resolve(e,"admin","src","extensions","_main-entry.ts"),a)}catch(i){c.panic("Failed to write the extensions entry file. See the error below for details:",{error:i})}}s(De,"createMainExtensionsEntry");async function R({appDir:e,dest:t,plugins:o}){let r=await Ae(e,t),n=Pe(o);await De(t,n,r),await _e(t,n)}s(R,"createEntry");async function Fe(e){let t=B.resolve(__dirname,"..","ui"),o=B.resolve(e,"admin");try{await We.copy(t,o,{filter:P})}catch(r){c.panic(`Could not copy the admin UI to ${o}. See the error below for details:`,{error:r})}}s(Fe,"copyAdmin");async function k({appDir:e,plugins:t}){let o=B.resolve(e,".cache");return await Fe(o),await R({appDir:e,dest:o,plugins:t}),{cacheDir:o}}s(k,"createCacheDir");import ie from"dotenv";import Te from"fs-extra";import ae from"node:path";var Ie=/^MEDUSA_ADMIN_/i,$="";switch(process.env.NODE_ENV){case"production":$=".env.production";break;case"staging":$=".env.staging";break;case"test":$=".env.test";break;case"development":default:$=".env";break}Te.existsSync($)?ie.config({path:ae.resolve(process.cwd(),$)}):$!==".env"&&ie.config({path:ae.resolve(process.cwd(),".env")});var G=s(e=>{let t=Object.keys(process.env).filter(r=>Ie.test(r)).reduce((r,n)=>(r[n]=process.env[n],r),{ADMIN_PATH:e.path||"/",NODE_ENV:e.env||"development",MEDUSA_BACKEND_URL:e.backend||process.env.MEDUSA_BACKEND_URL});return{"process.env":Object.keys(t).reduce((r,n)=>(r[n]=JSON.stringify(t[n]),r),{})}},"getClientEnv");import Re from"chokidar";import Le from"fs-extra";import C from"node:path";async function q(e,t,o){let r=C.resolve(e,"src","admin"),n=Re.watch(r,{ignored:/(^|[/\\])\../,ignoreInitial:!0});n.on("all",async(a,i)=>{(a==="unlinkDir"||a==="unlink")&&Ve(i,e,t),await R({appDir:e,dest:t,plugins:o}),c.info("Extensions cache directory was re-initialized")}),process.on("SIGINT",async()=>{await n.close()}).on("SIGTERM",async()=>{await n.close()})}s(q,"watchLocalAdminFolder");function Ve(e,t,o){let r=C.resolve(t,"src","admin"),n=C.relative(r,e),a=C.resolve(o,"admin","src","extensions"),i=C.resolve(a,n);try{Le.removeSync(i)}catch(d){c.error(`An error occurred while removing ${i}: ${d}`)}}s(Ve,"removeUnlinkedFile");import qe from"fs-extra";import Je from"node:path";import Ke from"webpack";function se(e){let{options:t}=e;t.path&&(t.path.startsWith("/")||c.panic("'path' in the options of `@medusajs/admin` must start with a '/'"),t.path!=="/"&&t.path.endsWith("/")&&c.panic("'path' in the options of `@medusajs/admin` cannot end with a '/'"),typeof t.path!="string"&&c.panic("'path' in the options of `@medusajs/admin` must be a string"))}s(se,"validateArgs");import Ne from"@pmmmwh/react-refresh-webpack-plugin";import Oe from"copy-webpack-plugin";import Ue from"html-webpack-plugin";import K from"mini-css-extract-plugin";import L from"node:path";import{SwcMinifyWebpackPlugin as ze}from"swc-minify-webpack-plugin";import Me from"webpack";import Be from"webpackbar";var J=["react","react-dom","react-router-dom","react-dnd","react-dnd-html5-backend","react-select","react-helmet-async","@tanstack/react-query","@tanstack/react-table","@emotion/react","medusa-react","@medusajs/ui","@medusajs/icons","@medusajs/ui-preset"];var ce=J.reduce((e,t)=>(e[`${t}$`]=S.resolve(t),e),{});function Ge(e){return e?e==="/"||e.endsWith("/")?e:`${e}/`:"/app/"}s(Ge,"formatPublicPath");function X({entry:e,dest:t,cacheDir:o,env:r,options:n,template:a,publicFolder:i,reporting:d="fancy"}){let f=r==="production",u=G({env:r,backend:n==null?void 0:n.backend,path:n==null?void 0:n.path}),l=Ge(n==null?void 0:n.path),y=f?[new K({filename:"[name].[chunkhash].css",chunkFilename:"[name].[chunkhash].css"}),new Be({basic:d==="minimal",fancy:d==="fancy"})]:[new K];return{mode:r,bail:!!f,devtool:f?!1:"eval-source-map",entry:[e],output:{path:t,filename:f?"[name].[contenthash:8].js":"[name].bundle.js",chunkFilename:f?"[name].[contenthash:8].chunk.js":"[name].chunk.js"},optimization:{minimize:!0,minimizer:[new ze],moduleIds:"deterministic",runtimeChunk:!0},module:{rules:[{test:/\.tsx?$/,exclude:/node_modules/,include:[o],use:{loader:"swc-loader",options:{jsc:{parser:{syntax:"typescript",jsx:!0},transform:{react:{runtime:"automatic"}}}}}},{test:/\.jsx?$/,exclude:/node_modules/,include:[o],use:{loader:"swc-loader",options:{jsc:{parser:{syntax:"ecmascript",jsx:!0},transform:{react:{runtime:"automatic"}}}}}},{test:/\.css$/,use:[K.loader,"css-loader","postcss-loader"]},{test:/\.svg$/,oneOf:[{type:"asset/resource",resourceQuery:/url/},{type:"asset/inline",resourceQuery:/base64/},{issuer:/\.[jt]sx?$/,use:["@svgr/webpack"]}],generator:{filename:`images/${f?"[name]-[hash][ext]":"[name][ext]"}`}},{test:/\.(eot|otf|ttf|woff|woff2)$/,type:"asset/resource"},{test:/\.(js|mjs)(\.map)?$/,enforce:"pre",use:["source-map-loader"]},{test:/\.m?jsx?$/,resolve:{fullySpecified:!1}}]},resolve:{alias:ce,symlinks:!1,extensions:[".js",".jsx",".ts",".tsx"],mainFields:["browser","module","main"],modules:["node_modules",L.resolve(__dirname,"..","node_modules")],fallback:{readline:!1,path:!1}},plugins:[new Ue({inject:!0,template:a||L.resolve(__dirname,"..","ui","index.html"),publicPath:l}),new Me.DefinePlugin(u),new Oe({patterns:[{from:i||L.resolve(__dirname,"..","ui","public"),to:L.resolve(t,"public")}]}),!f&&new Ne,...y].filter(Boolean)}}s(X,"getWebpackConfig");async function A(e,t){se(t);let o=X(t),r=Je.join(e,"src","admin","webpack.config.js");if(await qe.pathExists(r)){let a;try{a=S(r)}catch(i){c.panic("An error occured while trying to load your custom Webpack config. See the error below for details:",{error:i})}typeof a=="function"&&(t.devServer&&(o.devServer=t.devServer),o=a(o,Ke),o||c.panic("Nothing was returned from your custom webpack configuration"))}return o}s(A,"getCustomWebpackConfig");function le(e){return(t,o)=>e(t,o)}s(le,"withCustomWebpackConfig");async function de({appDir:e,buildDir:t,plugins:o,options:r,reporting:n="fancy"}){await k({appDir:e,plugins:o});let a=Z.resolve(e,".cache"),i=Z.resolve(a,"admin","src","main.tsx"),d=Z.resolve(e,t),u=await A(e,{entry:i,dest:d,cacheDir:a,env:"production",options:r,reporting:n}),l=Xe(u);return new Promise((y,x)=>{l.run((p,h)=>{p&&(p.details&&c.error(p.details),x(p));let w=h.toJson();return h.hasErrors()&&c.error(JSON.stringify(w.errors)),y({stats:h,warnings:w.warnings})})})}s(de,"build");import fe from"fs-extra";import ue from"node:path";async function pe({appDir:e,outDir:t}){let o=ue.resolve(e,".cache","admin"),r=ue.resolve(e,t);await fe.remove(r),await fe.remove(o)}s(pe,"clean");import me from"node:path";import Ze from"react-dev-utils/openBrowser";import He from"webpack";import Qe from"webpack-dev-server";async function he({appDir:e,buildDir:t,plugins:o,options:r={path:"/",backend:process.env.BE_URL??"http://localhost:9000",develop:{open:!0,port:7001,logLevel:"error",stats:"normal"}}}){let{cacheDir:n}=await k({appDir:e,plugins:o}),a=me.resolve(n,"admin","src","main.tsx"),i=me.resolve(e,t),f=await A(e,{entry:a,dest:i,cacheDir:n,env:"development",options:r}),u=He({...f,infrastructureLogging:{level:r.develop.logLevel},stats:r.develop.stats==="normal"?"errors-only":void 0}),l={port:r.develop.port,client:{logging:"none",overlay:{errors:!0,warnings:!1}},open:!1,onListening:r.develop.open?function(p){p||c.warn("Failed to open browser."),Ze(`http://localhost:${r.develop.port}${r.path?r.path:""}`)}:void 0,devMiddleware:{publicPath:r.path,stats:r.develop.stats==="normal"?!1:void 0},historyApiFallback:{index:r.path,disableDotRule:!0},hot:!0},y=new Qe(l,u);await s(async()=>{c.info(`Started development server on http://localhost:${r.develop.port}${r.path?r.path:""}`),await y.start()},"runServer")(),await q(e,n,o)}s(he,"develop");export{J as ALIASED_PACKAGES,de as build,pe as clean,he as develop,F as findAllValidRoutes,D as findAllValidSettings,W as findAllValidWidgets,V as forbiddenRoutes,N as injectionZones,c as logger,v as normalizePath,le as withCustomWebpackConfig};
//# sourceMappingURL=index.mjs.map