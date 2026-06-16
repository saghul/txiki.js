use std::panic;
use std::path::Path;
use std::slice;
use std::str;

use oxc_allocator::Allocator;
use oxc_codegen::Codegen;
use oxc_parser::Parser;
use oxc_semantic::SemanticBuilder;
use oxc_span::SourceType;
use oxc_transformer::{TransformOptions, Transformer};

/// WASI reactor marker: tells WAMR this module is a reactor
/// (exports functions for the host to call), not a command.
#[no_mangle]
pub extern "C" fn _initialize() {}

#[no_mangle]
pub extern "C" fn transpile(
    input_ptr: *const u8,
    input_len: i32,
    output_ptr: *mut u8,
    output_max: i32,
) -> i32 {
    panic::set_hook(Box::new(|_| {}));

    let result = std::panic::catch_unwind(|| {
        do_transpile(input_ptr, input_len, output_ptr, output_max)
    });

    match result {
        Ok(n) => n,
        Err(_) => {
            let err = b"{\"error\":\"internal transpiler panic\"}";
            let len = err.len().min(output_max as usize);
            unsafe {
                std::ptr::copy_nonoverlapping(err.as_ptr(), output_ptr, len);
            }
            len as i32
        }
    }
}

fn do_transpile(
    input_ptr: *const u8,
    input_len: i32,
    output_ptr: *mut u8,
    output_max: i32,
) -> i32 {
    if input_ptr.is_null() || input_len <= 0 || output_ptr.is_null() || output_max <= 0 {
        return -1;
    }

    let input_bytes = unsafe { slice::from_raw_parts(input_ptr, input_len as usize) };
    let input_str = match str::from_utf8(input_bytes) {
        Ok(s) => s,
        Err(_) => return -1,
    };

    let input: Input = match serde_json::from_str(input_str) {
        Ok(v) => v,
        Err(_) => return -1,
    };

    let source = input.source;
    let filename = input.filename.unwrap_or_default();

    let source_type = if filename.ends_with(".tsx") {
        SourceType::tsx()
    } else {
        SourceType::ts()
    };

    let allocator = Allocator::default();
    let ret = Parser::new(&allocator, &source, source_type).parse();

    let mut program = ret.program;

    // Run semantic analysis + transformer to strip types
    let scoping = SemanticBuilder::new()
        .with_excess_capacity(2.0)
        .build(&program)
        .semantic
        .into_scoping();

    let transform_options = TransformOptions {
        typescript: oxc_transformer::TypeScriptOptions {
            allow_namespaces: true,
            allow_declare_fields: true,
            ..Default::default()
        },
        ..Default::default()
    };

    let path = Path::new(&filename);
    let _ret = Transformer::new(&allocator, path, &transform_options)
        .build_with_scoping(scoping, &mut program);

    let codegen = Codegen::new();
    let output = codegen.build(&program);

    let result = Output {
        code: output.code,
        diagnostics: if ret.diagnostics.is_empty() {
            None
        } else {
            Some(
                ret.diagnostics
                    .iter()
                    .map(|d| Diagnostic {
                        message: d.to_string(),
                    })
                    .collect(),
            )
        },
    };

    let result_json = serde_json::to_string(&result).unwrap_or_default();
    let result_bytes = result_json.as_bytes();
    let len = result_bytes.len().min(output_max as usize);

    unsafe {
        std::ptr::copy_nonoverlapping(result_bytes.as_ptr(), output_ptr, len);
    }

    len as i32
}

#[derive(serde::Deserialize)]
struct Input {
    source: String,
    filename: Option<String>,
    #[allow(dead_code)]
    options: Option<serde_json::Value>,
}

#[derive(serde::Serialize)]
struct Output {
    code: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    diagnostics: Option<Vec<Diagnostic>>,
}

#[derive(serde::Serialize)]
struct Diagnostic {
    message: String,
}
