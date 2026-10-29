<x-mail::message>
# We received your request

Thanks, {{ Str::before($booking->name, ' ') }}. Your request for the {{ $booking->car->full_name }} is in. Everything about it is on your booking page, which also takes the deposit and your documents.

<x-mail::button :url="$booking->pageUrl()">
Open your booking
</x-mail::button>

<x-mail::table>
| | |
|:--|:--|
| Pick-up | {{ $booking->pickupLabel() }} |
| Return | {{ $booking->returnLabel() }} |
@if ($booking->occasion)
| Occasion | {{ $booking->occasionLabel() }} |
@endif
@include('mail.booking.price-rows')
| Refundable deposit | ${{ number_format($booking->deposit_usd) }} |
| Reference | {{ $booking->public_id }} |
</x-mail::table>

## What happens next

1. **Pay the ${{ number_format($booking->deposit_usd) }} deposit** to lock your dates. Until then they are held for {{ config('rental.hold_hours') }} hours. It is refundable and comes back after the car is returned.
2. **Upload your driver’s license and proof of full-coverage insurance.**
3. **We confirm your booking** by email, usually the same day.
4. **Pay for the rental** (${{ number_format($booking->totalWithTax(), 2) }}) from the same page, any time before pickup.

Pickup in Patchogue and nearby delivery are free; a farther drop-off is quoted when we confirm. The link to your booking page works for {{ config('rental.upload_link_days') }} days.

@include('mail.booking.questions')

</x-mail::message>
