use dep::quantized::quantized::Quantized;

fn main(x: [Quantized; 128]) -> pub Field {
    // Return hash of the registered face
    let mut field_arr = [0;128];
    for i in 0..128 {
      field_arr[i] = x[i].x;
    }
    poseidon::poseidon2::Poseidon2::hash(field_arr, 128)
}