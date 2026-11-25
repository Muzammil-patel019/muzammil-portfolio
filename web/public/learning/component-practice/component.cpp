#include <iostream>
#include <string>
#include <stdexcept>
int number(const std::string& text) {
    size_t used = 0;
    int value = std::stoi(text, &used);
    if (used != text.size()) throw std::invalid_argument("integer required");
    return value;
}
int main(int argc, char** argv) {
    try {
        if (argc != 3) throw std::invalid_argument("usage: component threshold sample");
        const int threshold = number(argv[1]);
        const int sample = number(argv[2]);
        if (threshold < 0 || threshold > 100) throw std::out_of_range("threshold must be 0..100");
        std::cout << (sample > threshold ? "ALERT" : "OK") << '\n';
        return 0;
    } catch (const std::exception& error) {
        std::cerr << error.what() << '\n';
        return 2;
    }
}
