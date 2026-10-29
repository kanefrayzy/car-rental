<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * The contact form on the website (the /contact page and the Contact section on the home
 * page). `company` is a honeypot: hidden from people, filled in by bots; the controller drops
 * such messages without telling the sender.
 */
class ContactRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'firstName' => ['required', 'string', 'max:60'],
            'lastName' => ['required', 'string', 'max:60'],
            'email' => ['required', 'string', 'email:rfc', 'max:190'],
            'phone' => [
                'required',
                'string',
                'max:32',
                function (string $attribute, mixed $value, Closure $fail) {
                    $digits = preg_replace('/\D/', '', (string) $value);
                    if (! (strlen($digits) === 10 || (strlen($digits) === 11 && str_starts_with($digits, '1')))) {
                        $fail('Enter a 10-digit US phone number.');
                    }
                },
            ],
            'occasion' => ['required', 'string', Rule::in(array_keys(config('rental.contact_topics')))],
            'preferredDates' => ['nullable', 'string', 'max:120'],
            'message' => ['required', 'string', 'min:10', 'max:2000'],
            'company' => ['nullable', 'string', 'max:200'],
        ];
    }

    public function messages(): array
    {
        return [
            'firstName.required' => 'Enter your first name.',
            'firstName.max' => 'That name is too long.',
            'lastName.required' => 'Enter your last name.',
            'lastName.max' => 'That name is too long.',
            'email.required' => 'Enter your email, so we can answer.',
            'email.email' => 'Enter a valid email address.',
            'phone.required' => 'Enter a 10-digit US phone number.',
            'occasion.required' => 'Choose what it’s for.',
            'occasion.in' => 'Choose what it’s for from the list.',
            'preferredDates.max' => 'Keep the dates short: 120 characters at most.',
            'message.required' => 'Write your message.',
            'message.min' => 'Tell us a little more: at least 10 characters.',
            'message.max' => 'That message is too long. Keep it under 2,000 characters.',
        ];
    }

    public function isBot(): bool
    {
        return trim((string) $this->input('company')) !== '';
    }

    /** "Jordan Rivera", with spacing tidied. */
    public function fullName(): string
    {
        $tidy = fn (string $key) => trim(preg_replace('/\s+/', ' ', (string) $this->validated($key)));

        return $tidy('firstName').' '.$tidy('lastName');
    }
}
