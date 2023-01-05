#!/bin/bash
set -e



function filename(){
    local name="${1##*/}"
    echo ${name%.*}
}

FILE=$1
shift

cat << EOF > $FILE
#include <stdio.h>
#include <string.h>
EOF

for i in "$@"
do
   echo "#include \"${i#"src/js/"}\"" >> $FILE
done

cat << EOF >> $FILE

#define SEED    0x12345678

typedef struct lookup_item_t { const char *key; uint8_t key_len; void *value; uint32_t size;  } lookup_item_t;


lookup_item_t precompiled_lookup_table[] = {
EOF

for i in "$@"
do
   FILE_PARTS=(${i//\// })
   MODULE_BASE=${FILE_PARTS[2]}

   case $MODULE_BASE in
      "core")
        MODULE_FILE_NAME="${FILE_PARTS[4]}"
        if [[ "${FILE_PARTS[3]}" == "polyfills" ]]; then
            MODULE_BASE="internal/polyfill"
        else
            MODULE_BASE=""
        fi
        ;;
      "stdlib")
        MODULE_BASE="std"
        MODULE_FILE_NAME="${FILE_PARTS[3]}"
        ;;
   esac

   MODULE_FILE_NAME=$(filename $MODULE_FILE_NAME)
   COMPILED_FILE_NAME=$(echo ${MODULE_FILE_NAME} | tr '-' '_') 
   MODULE_NAME="@tjs/"
   COMPILED_NAME="tjs__"

   if [ ! -z $MODULE_BASE ]; then
      MODULE_NAME="${MODULE_NAME}${MODULE_BASE}/"
      COMPILED_NAME="${COMPILED_NAME}$(echo $MODULE_BASE | tr '/' '_')_"
   else
     COMPILED_NAME="${COMPILED_NAME}core_"
   fi
   

   MODULE_NAME="${MODULE_NAME}${MODULE_FILE_NAME}"
   COMPILED_NAME="${COMPILED_NAME}${COMPILED_FILE_NAME}"

   echo "Generating $MODULE_NAME"
   echo "   { \"${MODULE_NAME}\", ${#MODULE_NAME}, (void *)&${COMPILED_NAME}, ${COMPILED_NAME}_size }," >> $FILE
done

cat << EOF >> $FILE
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
EOF

