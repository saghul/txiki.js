#include <string.h>
#include <stdlib.h>
#include <time.h>

struct bla {
	int ok;
	int b;
	int c[10];
	char d[10];
};

void* rand_ptr = (void*)0x1234;
void* get_rand_ptr(){
	return rand_ptr;
}

struct bla check_rand_ptr(void* ptr){
	struct bla ret;
	printf("ptr check %llx == %llx\n", ptr, rand_ptr);
	ret.ok = (rand_ptr == ptr);
	ret.b = 1;
	ret.c[0] = 0;
	ret.c[1] = 1;
	ret.c[2] = 2;
	ret.c[3] = 3;
	ret.c[4] = 4;
	ret.c[5] = 5;
	ret.c[6] = 6;
	ret.c[7] = 7;
	ret.c[8] = 8;
	ret.c[9] = 9;
	strcpy(ret.d, "hello");

	return ret;
}

struct bla* check_rand_ptr2(void* ptr){
	static struct bla ret;
	ret = check_rand_ptr(ptr);
	return &ret;
}

struct tm* time_test(time_t* t){
	printf("time_test %d\n", sizeof(time_t));
	time_t t2 = time(NULL);
	printf("time arg %lld, now %lld\n", *t, t2);
	struct tm* tm = localtime(&t);
	printf("time_test year %d, mon %d, mday %d, hour %d, min %d, sec %d, wday %d, yday %d, isdst %d\n", tm->tm_year, tm->tm_mon, tm->tm_mday, tm->tm_hour, tm->tm_min, tm->tm_sec, tm->tm_wday, tm->tm_yday, tm->tm_isdst);
	return tm;
}


int call_callback(int (*fun)(int), int a){
	return fun(a);
}
