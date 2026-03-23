.PHONY: build build-hype-usd build-mantra-usd build-hype-mantra clean

WASM_DIR = target/wasm32-wasip1/release-wasm

build: build-hype-usd build-mantra-usd build-hype-mantra

build-hype-usd:
	cargo build --target wasm32-wasip1 --profile release-wasm -p hype-usd
	wasm-strip $(WASM_DIR)/hype-usd.wasm
	wasm-opt -Oz --enable-bulk-memory $(WASM_DIR)/hype-usd.wasm -o $(WASM_DIR)/hype-usd.wasm

build-mantra-usd:
	cargo build --target wasm32-wasip1 --profile release-wasm -p mantra-usd
	wasm-strip $(WASM_DIR)/mantra-usd.wasm
	wasm-opt -Oz --enable-bulk-memory $(WASM_DIR)/mantra-usd.wasm -o $(WASM_DIR)/mantra-usd.wasm

build-hype-mantra:
	cargo build --target wasm32-wasip1 --profile release-wasm -p hype-mantra
	wasm-strip $(WASM_DIR)/hype-mantra.wasm
	wasm-opt -Oz --enable-bulk-memory $(WASM_DIR)/hype-mantra.wasm -o $(WASM_DIR)/hype-mantra.wasm

clean:
	cargo clean
