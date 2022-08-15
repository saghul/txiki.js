#include <string.h>
#include <stdlib.h>
#include <time.h>

int call_callback(int (*fun)(int), int a){
	return fun(a);
}
