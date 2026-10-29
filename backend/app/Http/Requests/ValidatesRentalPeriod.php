<?php

namespace App\Http\Requests;

use App\Support\RentalTime;
use Carbon\CarbonImmutable;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The car, date and time rules shared by the availability check and the booking request.
 * The site runs the same checks in the browser for speed; these are the ones that count.
 * Field names are camelCase because that is what the site sends. Dates and times are the
 * business's (rental.timezone, New York).
 */
trait ValidatesRentalPeriod
{
    /** @return array<string, array<int, mixed>> */
    protected function rentalPeriodRules(): array
    {
        $today = CarbonImmutable::now(config('rental.timezone'))->startOfDay();

        return [
            'carSlug' => [
                'required',
                'string',
                Rule::exists('cars', 'slug')->where('is_active', true),
            ],
            'pickupDate' => [
                'required',
                'date_format:Y-m-d',
                'after_or_equal:'.$today->toDateString(),
                'before_or_equal:'.$today->addDays(config('rental.max_advance_days'))->toDateString(),
            ],
            'pickupTime' => ['required', 'string', Rule::in(RentalTime::slots())],
            // The same day is allowed; the time decides (see validateRentalLength).
            'returnDate' => ['required', 'date_format:Y-m-d', 'after_or_equal:pickupDate'],
            'returnTime' => ['required', 'string', Rule::in(RentalTime::slots())],
        ];
    }

    /** @return array<string, string> */
    protected function rentalPeriodMessages(): array
    {
        $hours = RentalTime::label(config('rental.hours.open')).' to '.RentalTime::label(config('rental.hours.close'));

        return [
            'carSlug.required' => 'Choose a car.',
            'carSlug.exists' => 'We couldn’t find that car.',
            'pickupDate.required' => 'Choose a pick-up date.',
            'pickupDate.date_format' => 'Choose a pick-up date.',
            'pickupDate.after_or_equal' => 'Pick-up can’t be in the past.',
            'pickupDate.before_or_equal' => 'That pick-up date is too far ahead.',
            'pickupTime.required' => 'Choose a pick-up time.',
            'pickupTime.in' => "Choose a pick-up time from {$hours}.",
            'returnDate.required' => 'Choose a return date.',
            'returnDate.date_format' => 'Choose a return date.',
            'returnDate.after_or_equal' => 'Return must be after pick-up.',
            'returnTime.required' => 'Choose a return time.',
            'returnTime.in' => "Choose a return time from {$hours}.",
        ];
    }

    /** Order, start and length of the period, checked once each field is valid on its own. */
    protected function validateRentalLength(Validator $validator): void
    {
        if ($validator->errors()->hasAny(['pickupDate', 'pickupTime', 'returnDate', 'returnTime'])) {
            return;
        }

        $pickup = $this->pickupAt();
        $return = $this->returnAt();

        if ($pickup->lte(CarbonImmutable::now(config('rental.timezone')))) {
            $validator->errors()->add('pickupTime', 'That pick-up time has passed. Choose a later one.');

            return;
        }
        if ($return->lte($pickup)) {
            $validator->errors()->add('returnTime', 'Return must be after pick-up.');

            return;
        }

        $days = RentalTime::billedDays($pickup, $return);
        $min = config('rental.min_rental_days');
        $max = config('rental.max_rental_days');

        if ($days < $min) {
            $validator->errors()->add('returnDate', "The shortest rental is {$min} ".str('day')->plural($min).'.');
        } elseif ($days > $max) {
            $validator->errors()->add('returnDate', "The longest rental is {$max} days. Call us for a longer one.");
        }
    }

    public function pickupAt(): CarbonImmutable
    {
        return RentalTime::at($this->input('pickupDate'), $this->input('pickupTime'));
    }

    public function returnAt(): CarbonImmutable
    {
        return RentalTime::at($this->input('returnDate'), $this->input('returnTime'));
    }
}
