#include <sqlite3ext.h>

SQLITE_EXTENSION_INIT1

void fn(sqlite3_context* context ,int argc, sqlite3_value** argv) {
  sqlite3_result_int64(context, 43);
}

#ifdef _WIN32
__declspec(dllexport)
#endif

int sqlite_test_ext_init(
  sqlite3 *db,
  char **pzErrMsg,
  const sqlite3_api_routines *pApi
){
  int rc = SQLITE_OK;
  SQLITE_EXTENSION_INIT2(pApi);
  /* Insert here calls to
  **     sqlite3_create_function_v2(),
  **     sqlite3_create_collation_v2(),
  **     sqlite3_create_module_v2(), and/or
  **     sqlite3_vfs_register()
  ** to register the new features that your extension adds.
  */
  sqlite3_create_function_v2(db,"testfn",0, SQLITE_UTF8|SQLITE_INNOCUOUS|SQLITE_DETERMINISTIC, 0, fn, 0, 0, 0);
  return rc;
}
