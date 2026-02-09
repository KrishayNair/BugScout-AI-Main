"use strict";
/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
self["webpackHotUpdate_N_E"]("middleware",{

/***/ "(middleware)/./middleware.ts":
/*!***********************!*\
  !*** ./middleware.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   config: () => (/* binding */ config),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\n/* harmony import */ var _clerk_nextjs_server__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! @clerk/nextjs/server */ \"(middleware)/./node_modules/@clerk/nextjs/dist/esm/server/routeMatcher.js\");\n/* harmony import */ var _clerk_nextjs_server__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! @clerk/nextjs/server */ \"(middleware)/./node_modules/@clerk/nextjs/dist/esm/server/clerkMiddleware.js\");\n\nconst isPublicRoute = (0,_clerk_nextjs_server__WEBPACK_IMPORTED_MODULE_0__.createRouteMatcher)([\n    \"/\",\n    \"/sign-in(.*)\",\n    \"/sign-up(.*)\",\n    \"/api/db/vector-sync\",\n    \"/api/db/sync-to-chroma\",\n    \"/api/cron/vector-sync\"\n]);\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ((0,_clerk_nextjs_server__WEBPACK_IMPORTED_MODULE_1__.clerkMiddleware)((auth, req)=>{\n    if (!isPublicRoute(req)) {\n        auth().protect();\n    }\n}));\nconst config = {\n    matcher: [\n        \"/((?!_next|[^?]*\\\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ico|woff2?|map|json)).*)\",\n        \"/(api|trpc)(.*)\"\n    ]\n};\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKG1pZGRsZXdhcmUpLy4vbWlkZGxld2FyZS50cyIsIm1hcHBpbmdzIjoiOzs7Ozs7O0FBQTJFO0FBRTNFLE1BQU1FLGdCQUFnQkQsd0VBQWtCQSxDQUFDO0lBQ3ZDO0lBQ0E7SUFDQTtJQUNBO0lBQ0E7SUFDQTtDQUNEO0FBRUQsaUVBQWVELHFFQUFlQSxDQUFDLENBQUNHLE1BQU1DO0lBQ3BDLElBQUksQ0FBQ0YsY0FBY0UsTUFBTTtRQUN2QkQsT0FBT0UsT0FBTztJQUNoQjtBQUNGLEVBQUUsRUFBQztBQUVJLE1BQU1DLFNBQVM7SUFDcEJDLFNBQVM7UUFDUDtRQUNBO0tBQ0Q7QUFDSCxFQUFFIiwic291cmNlcyI6WyJ3ZWJwYWNrOi8vX05fRS8uL21pZGRsZXdhcmUudHM/NDIyZCJdLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgeyBjbGVya01pZGRsZXdhcmUsIGNyZWF0ZVJvdXRlTWF0Y2hlciB9IGZyb20gXCJAY2xlcmsvbmV4dGpzL3NlcnZlclwiO1xyXG5cclxuY29uc3QgaXNQdWJsaWNSb3V0ZSA9IGNyZWF0ZVJvdXRlTWF0Y2hlcihbXHJcbiAgXCIvXCIsXHJcbiAgXCIvc2lnbi1pbiguKilcIixcclxuICBcIi9zaWduLXVwKC4qKVwiLFxyXG4gIFwiL2FwaS9kYi92ZWN0b3Itc3luY1wiLFxyXG4gIFwiL2FwaS9kYi9zeW5jLXRvLWNocm9tYVwiLFxyXG4gIFwiL2FwaS9jcm9uL3ZlY3Rvci1zeW5jXCIsXHJcbl0pO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgY2xlcmtNaWRkbGV3YXJlKChhdXRoLCByZXEpID0+IHtcclxuICBpZiAoIWlzUHVibGljUm91dGUocmVxKSkge1xyXG4gICAgYXV0aCgpLnByb3RlY3QoKTtcclxuICB9XHJcbn0pO1xyXG5cclxuZXhwb3J0IGNvbnN0IGNvbmZpZyA9IHtcclxuICBtYXRjaGVyOiBbXHJcbiAgICBcIi8oKD8hX25leHR8W14/XSpcXFxcLig/Omh0bWw/fGNzc3xqcyg/IW9uKXxqcGU/Z3x3ZWJwfHBuZ3xnaWZ8c3ZnfGljb3x3b2ZmMj98bWFwfGpzb24pKS4qKVwiLFxyXG4gICAgXCIvKGFwaXx0cnBjKSguKilcIixcclxuICBdLFxyXG59O1xyXG4iXSwibmFtZXMiOlsiY2xlcmtNaWRkbGV3YXJlIiwiY3JlYXRlUm91dGVNYXRjaGVyIiwiaXNQdWJsaWNSb3V0ZSIsImF1dGgiLCJyZXEiLCJwcm90ZWN0IiwiY29uZmlnIiwibWF0Y2hlciJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(middleware)/./middleware.ts\n");

/***/ })

});