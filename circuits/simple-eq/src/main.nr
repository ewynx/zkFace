// Embedding uses 128 quantized
// Input are 2 embeddings
// having 256 inputs is fine

pub fn main(x: [Field; 128], y: [Field; 128]) -> pub bool {
    // assert(x == y);
    // TODO 
    x[0] == y[0]
}
