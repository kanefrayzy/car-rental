<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class StoreBookingRequest extends FormRequest
{
    use ValidatesRentalPeriod;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            ...$this->rentalPeriodRules(),
            'name' => [
                'required',
                'string',
                'max:120',
                function (string $attribute, mixed $value, Closure $fail) {
                    if (count(preg_split('/\s+/', trim((string) $value), -1, PREG_SPLIT_NO_EMPTY)) < 2) {
                        $fail('Enter your first and last name, as on your license.');
                    }
                },
            ],
            'phone' => [
                'required',
                'string',
                'max:32',
                function (string $attribute, mixed $value, Closure $fail) {
                    if ($this->usPhoneDigits((string) $value) === null) {
                        $fail('Enter a 10-digit US phone number.');
                    }
                },
            ],
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            // What the car is for, from the Occasions cards; optional.
            'occasion' => ['nullable', 'string', Rule::in(array_keys(config('rental.occasions')))],
            // The "I agree to the Rental Terms" checkbox.
            'acceptTerms' => ['accepted'],
        ];
    }

    public function messages(): array
    {
        return [
            ...$this->rentalPeriodMessages(),
            'name.required' => 'Enter your first and last name, as on your license.',
            'phone.required' => 'Enter a 10-digit US phone number.',
            'email.required' => 'Enter a valid email address.',
            'email.email' => 'Enter a valid email address.',
            'occasion.in' => 'Choose an occasion from the list.',
            'acceptTerms.accepted' => 'Agree to the Rental Terms to send your request.',
        ];
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateRentalLength($validator)];
    }

    /** The phone number as it is stored: +1 followed by ten digits. */
    public function normalizedPhone(): string
    {
        return '+1'.$this->usPhoneDigits((string) $this->input('phone'));
    }

    /** Ten digits of a US number, with an optional leading country code 1 dropped; null if invalid. */
    private function usPhoneDigits(string $value): ?string
    {
        $digits = preg_replace('/\D/', '', $value);

        if (strlen($digits) === 11 && str_starts_with($digits, '1')) {
            $digits = substr($digits, 1);
        }

        return strlen($digits) === 10 ? $digits : null;
    }
}
