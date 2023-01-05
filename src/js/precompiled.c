#include <stdio.h>
#include <string.h>
#include "stdlib/assert.c"
#include "stdlib/getopts.c"
#include "stdlib/hashlib.c"
#include "stdlib/ipaddr.c"
#include "stdlib/path.c"
#include "stdlib/uuid.c"
#include "core/polyfills/abortcontroller.c"
#include "core/polyfills/blob.c"
#include "core/polyfills/crypto.c"
#include "core/polyfills/event-target.c"
#include "core/polyfills/performance.c"
#include "core/polyfills/text-encoding.c"
#include "core/polyfills/url-pattern.c"
#include "core/polyfills/url.c"
#include "core/polyfills/wasm.c"
#include "core/polyfills/web-streams.c"
#include "core/polyfills/whatwg-fetch.c"
#include "core/polyfills/worker.c"
#include "core/polyfills/ws.c"
#include "core/polyfills/xhr.c"
#include "core/tjs/alert-confirm-prompt.c"
#include "core/tjs/eval-stdin.c"
#include "core/tjs/ffi.c"
#include "core/tjs/fs.c"
#include "core/tjs/posix-socket.c"
#include "core/tjs/repl.c"
#include "core/tjs/run-tests.c"
#include "core/tjs/signal.c"
#include "core/tjs/sockets.c"
#include "core/tjs/stream-utils.c"
#include "core/tjs/worker-bootstrap.c"

#define SEED    0x12345678

typedef struct lookup_item_t { const char *key; uint8_t key_len; void *value; uint32_t size;  } lookup_item_t;


lookup_item_t precompiled_lookup_table[] = {
   { "@tjs/std/assert", 15, (void *)&tjs__std_assert, tjs__std_assert_size },
   { "@tjs/std/getopts", 16, (void *)&tjs__std_getopts, tjs__std_getopts_size },
   { "@tjs/std/hashlib", 16, (void *)&tjs__std_hashlib, tjs__std_hashlib_size },
   { "@tjs/std/ipaddr", 15, (void *)&tjs__std_ipaddr, tjs__std_ipaddr_size },
   { "@tjs/std/path", 13, (void *)&tjs__std_path, tjs__std_path_size },
   { "@tjs/std/uuid", 13, (void *)&tjs__std_uuid, tjs__std_uuid_size },
   { "@tjs/internal/polyfill/abortcontroller", 38, (void *)&tjs__internal_polyfill_abortcontroller, tjs__internal_polyfill_abortcontroller_size },
   { "@tjs/internal/polyfill/blob", 27, (void *)&tjs__internal_polyfill_blob, tjs__internal_polyfill_blob_size },
   { "@tjs/internal/polyfill/crypto", 29, (void *)&tjs__internal_polyfill_crypto, tjs__internal_polyfill_crypto_size },
   { "@tjs/internal/polyfill/event-target", 35, (void *)&tjs__internal_polyfill_event_target, tjs__internal_polyfill_event_target_size },
   { "@tjs/internal/polyfill/performance", 34, (void *)&tjs__internal_polyfill_performance, tjs__internal_polyfill_performance_size },
   { "@tjs/internal/polyfill/text-encoding", 36, (void *)&tjs__internal_polyfill_text_encoding, tjs__internal_polyfill_text_encoding_size },
   { "@tjs/internal/polyfill/url-pattern", 34, (void *)&tjs__internal_polyfill_url_pattern, tjs__internal_polyfill_url_pattern_size },
   { "@tjs/internal/polyfill/url", 26, (void *)&tjs__internal_polyfill_url, tjs__internal_polyfill_url_size },
   { "@tjs/internal/polyfill/wasm", 27, (void *)&tjs__internal_polyfill_wasm, tjs__internal_polyfill_wasm_size },
   { "@tjs/internal/polyfill/web-streams", 34, (void *)&tjs__internal_polyfill_web_streams, tjs__internal_polyfill_web_streams_size },
   { "@tjs/internal/polyfill/whatwg-fetch", 35, (void *)&tjs__internal_polyfill_whatwg_fetch, tjs__internal_polyfill_whatwg_fetch_size },
   { "@tjs/internal/polyfill/worker", 29, (void *)&tjs__internal_polyfill_worker, tjs__internal_polyfill_worker_size },
   { "@tjs/internal/polyfill/ws", 25, (void *)&tjs__internal_polyfill_ws, tjs__internal_polyfill_ws_size },
   { "@tjs/internal/polyfill/xhr", 26, (void *)&tjs__internal_polyfill_xhr, tjs__internal_polyfill_xhr_size },
   { "@tjs/alert-confirm-prompt", 25, (void *)&tjs__core_alert_confirm_prompt, tjs__core_alert_confirm_prompt_size },
   { "@tjs/eval-stdin", 15, (void *)&tjs__core_eval_stdin, tjs__core_eval_stdin_size },
   { "@tjs/ffi", 8, (void *)&tjs__core_ffi, tjs__core_ffi_size },
   { "@tjs/fs", 7, (void *)&tjs__core_fs, tjs__core_fs_size },
   { "@tjs/posix-socket", 17, (void *)&tjs__core_posix_socket, tjs__core_posix_socket_size },
   { "@tjs/repl", 9, (void *)&tjs__core_repl, tjs__core_repl_size },
   { "@tjs/run-tests", 14, (void *)&tjs__core_run_tests, tjs__core_run_tests_size },
   { "@tjs/signal", 11, (void *)&tjs__core_signal, tjs__core_signal_size },
   { "@tjs/sockets", 12, (void *)&tjs__core_sockets, tjs__core_sockets_size },
   { "@tjs/stream-utils", 17, (void *)&tjs__core_stream_utils, tjs__core_stream_utils_size },
   { "@tjs/worker-bootstrap", 21, (void *)&tjs__core_worker_bootstrap, tjs__core_worker_bootstrap_size },
   { NULL, 0, NULL, 0 },
};

void *tjs__precompiled_lookup(const char *name, uint32_t **size)
{ 
   uint8_t name_len = strlen(name);
   for (lookup_item_t *p = precompiled_lookup_table; p->key != NULL; ++p) {
      if (p->key_len == name_len && strcmp(p->key, name) == 0) {
         *size = &(p->size);
         return p->value;
      }
   }
   return NULL;
}
