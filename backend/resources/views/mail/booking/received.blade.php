<x-mail::message>
# New booking request

**{{ $booking->name }}** wants the {{ $booking->car->full_name }}.

<x-mail::table>
| | |
|:--|:--|
| Pick-up | {{ $booking->pickupLabel() }} |
| Return | {{ $booking->returnLabel() }} |
@if ($booking->occasion)
| Occasion | {{ $booking->occasionLabel() }} |
@endif
@include('mail.booking.price-rows')
@if ($booking->usesHold())
| Deposit | ${{ number_format($booking->deposit_usd) }} hold, card not saved yet |
@else
| Deposit | ${{ number_format($booking->deposit_usd) }} (not paid yet) |
@endif
| Phone | {{ $booking->displayPhone() }} |
| Email | {{ $booking->email }} |
| Reference | {{ $booking->public_id }} |
</x-mail::table>

<x-mail::button :url="route('filament.admin.resources.bookings.view', $booking)">
Open in the admin panel
</x-mail::button>

## Documents

Not uploaded yet. The customer got a link to upload their license and insurance; you will get an email when they do.

Reply to this message to write to the customer.

@if ($booking->usesHold())
The dates are held for {{ config('rental.hold_hours') }} hours. After that they open up again unless the customer saves a card for the deposit hold. The ${{ number_format($booking->deposit_usd) }} hold goes on that card {{ config('rental.deposit.hold_hours_before_pickup') }} hours before pickup.
@else
The dates are held for {{ config('rental.hold_hours') }} hours. After that they open up again unless the deposit is paid.
@endif
</x-mail::message>
