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
| Deposit | ${{ number_format($booking->deposit_usd) }} (not paid yet) |
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

The dates are held for {{ config('rental.hold_hours') }} hours. After that they open up again unless the deposit is paid.
</x-mail::message>
