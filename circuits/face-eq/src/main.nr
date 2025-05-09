use dep::quantized::quantized::Quantized;

// Prove that you match a registered face
pub fn main(x: [Quantized; 128], registered: [Quantized; 128]) -> pub Field {
    let mut sum: Quantized = Quantized::new(0);

    for i in 0..128 {
      let diff = x[i] - registered[i];
      sum += diff;
    }

    // Match threshold = 1_500_000_000
    assert(sum < Quantized::new(98304000000000));
    // Return hash of the registered face
    let mut field_arr = [0;128];
    for i in 0..128 {
      field_arr[i] = registered[i].x;
    }
    poseidon::poseidon2::Poseidon2::hash(field_arr, 128)
}
