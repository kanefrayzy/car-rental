<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class CheckAvailabilityRequest extends FormRequest
{
    use ValidatesRentalPeriod;

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return $this->rentalPeriodRules();
    }

    public function messages(): array
    {
        return $this->rentalPeriodMessages();
    }

    public function after(): array
    {
        return [fn (Validator $validator) => $this->validateRentalLength($validator)];
    }
}
