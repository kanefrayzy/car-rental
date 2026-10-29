<?php

namespace App\Filament\Resources\BlockedPeriods\Schemas;

use App\Models\Car;
use App\Services\AvailabilityService;
use Carbon\CarbonImmutable;
use Closure;
use Filament\Forms\Components\DatePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;

class BlockedPeriodForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->columns(['default' => 1, 'sm' => 2])
            ->components([
                Select::make('car_id')
                    ->label('Car')
                    ->relationship('car', 'name')
                    ->default(fn () => Car::orderBy('position')->value('id'))
                    ->required()
                    ->columnSpanFull(),
                DatePicker::make('starts_on')
                    ->label('First closed day')
                    ->native(false)
                    ->displayFormat('M j, Y')
                    ->required()
                    ->live(),
                DatePicker::make('ends_on')
                    ->label('Last closed day')
                    ->native(false)
                    ->displayFormat('M j, Y')
                    ->required()
                    ->afterOrEqual('starts_on')
                    ->rule(fn ($get): Closure => self::noBookingsInside($get('car_id'), $get('starts_on'))),
                TextInput::make('note')
                    ->label('Reason (only you see it)')
                    ->placeholder('Service, private trip...')
                    ->maxLength(255)
                    ->columnSpanFull(),
            ]);
    }

    /** Closing dates that a customer already holds would double-book the car. */
    private static function noBookingsInside(?int $carId, ?string $startsOn): Closure
    {
        return function (string $attribute, mixed $endsOn, Closure $fail) use ($carId, $startsOn): void {
            $car = $carId ? Car::find($carId) : null;
            if (! $car || ! $startsOn || ! $endsOn) {
                return;
            }

            $bookings = app(AvailabilityService::class)->conflictingBookings(
                $car,
                CarbonImmutable::parse($startsOn),
                CarbonImmutable::parse($endsOn),
            );

            if ($bookings->isNotEmpty()) {
                $names = $bookings->map(fn ($booking) => "{$booking->name} ({$booking->pickup_date->format('M j')} to {$booking->return_date->format('M j')})")->join(', ');
                $fail("These dates include a booking: {$names}. Cancel it first, or close other dates.");
            }
        };
    }
}
