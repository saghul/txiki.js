#include <stdio.h>
#include <string.h>
#include "stdlib/assert.c"
#include "stdlib/getopts.c"
#include "stdlib/hashlib.c"
#include "stdlib/path.c"
#include "stdlib/uuid.c"
#include "core/polyfills/blob.c"
#include "core/polyfills/console.c"
#include "core/polyfills/crypto.c"
#include "core/polyfills/event-target-polyfill.c"
#include "core/polyfills/event-target.c"
#include "core/polyfills/performance.c"
#include "core/polyfills/text-encoding.c"
#include "core/polyfills/url-polyfill.c"
#include "core/polyfills/wasm.c"
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
#include "core/tjs/stdio.c"
#include "core/tjs/stream-utils.c"
#include "core/tjs/worker-bootstrap.c"

#define SEED    0x12345678

static inline uint32_t tjs__murmur_oaat_32(const char* str)
{
    uint32_t h = SEED;
    for (; *str; ++str) {
        h ^= *str;
        h *= 0x5bd1e995;
        h ^= h >> 15;
    }
    return h;
}

typedef struct lookup_item_t { const char *key; uint8_t key_len; void *value; uint32_t size;  } lookup_item_t;


lookup_item_t precompiled_lookup_table[] = {
   { "@tjs/std/assert", 15, (void *)&tjs__std_assert, tjs__std_assert_size },
   { "@tjs/std/getopts", 16, (void *)&tjs__std_getopts, tjs__std_getopts_size },
   { "@tjs/std/hashlib", 16, (void *)&tjs__std_hashlib, tjs__std_hashlib_size },
   { "@tjs/std/path", 13, (void *)&tjs__std_path, tjs__std_path_size },
   { "@tjs/std/uuid", 13, (void *)&tjs__std_uuid, tjs__std_uuid_size },
   { "@tjs/polyfill/blob", 18, (void *)&tjs__polyfill_blob, tjs__polyfill_blob_size },
   { "@tjs/polyfill/console", 21, (void *)&tjs__polyfill_console, tjs__polyfill_console_size },
   { "@tjs/polyfill/crypto", 20, (void *)&tjs__polyfill_crypto, tjs__polyfill_crypto_size },
   { "@tjs/polyfill/event-target-polyfill", 35, (void *)&tjs__polyfill_event_target_polyfill, tjs__polyfill_event_target_polyfill_size },
   { "@tjs/polyfill/event-target", 26, (void *)&tjs__polyfill_event_target, tjs__polyfill_event_target_size },
   { "@tjs/polyfill/performance", 25, (void *)&tjs__polyfill_performance, tjs__polyfill_performance_size },
   { "@tjs/polyfill/text-encoding", 27, (void *)&tjs__polyfill_text_encoding, tjs__polyfill_text_encoding_size },
   { "@tjs/polyfill/url-polyfill", 26, (void *)&tjs__polyfill_url_polyfill, tjs__polyfill_url_polyfill_size },
   { "@tjs/polyfill/wasm", 18, (void *)&tjs__polyfill_wasm, tjs__polyfill_wasm_size },
   { "@tjs/polyfill/worker", 20, (void *)&tjs__polyfill_worker, tjs__polyfill_worker_size },
   { "@tjs/polyfill/ws", 16, (void *)&tjs__polyfill_ws, tjs__polyfill_ws_size },
   { "@tjs/polyfill/xhr", 17, (void *)&tjs__polyfill_xhr, tjs__polyfill_xhr_size },
   { "@tjs/alert-confirm-prompt", 25, (void *)&tjs__core_alert_confirm_prompt, tjs__core_alert_confirm_prompt_size },
   { "@tjs/eval-stdin", 15, (void *)&tjs__core_eval_stdin, tjs__core_eval_stdin_size },
   { "@tjs/ffi", 8, (void *)&tjs__core_ffi, tjs__core_ffi_size },
   { "@tjs/fs", 7, (void *)&tjs__core_fs, tjs__core_fs_size },
   { "@tjs/posix-socket", 17, (void *)&tjs__core_posix_socket, tjs__core_posix_socket_size },
   { "@tjs/repl", 9, (void *)&tjs__core_repl, tjs__core_repl_size },
   { "@tjs/run-tests", 14, (void *)&tjs__core_run_tests, tjs__core_run_tests_size },
   { "@tjs/signal", 11, (void *)&tjs__core_signal, tjs__core_signal_size },
   { "@tjs/sockets", 12, (void *)&tjs__core_sockets, tjs__core_sockets_size },
   { "@tjs/stdio", 10, (void *)&tjs__core_stdio, tjs__core_stdio_size },
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
