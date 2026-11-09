<x-mail::message>
# Please confirm your security hold

Hi {{ Str::before($booking->name, ' ') }}, we tried to place the ${{ number_format($booking->deposit_usd) }} refundable hold on your card for the {{ $booking->car->full_name }}, and your bank did not approve it. It may have declined it, or it wants you to confirm it yourself. Nothing was charged.

Confirm the hold on your booking page. You can use the same card or another one.

<x-mail::button :url="$booking->pageUrl()">
Confirm the hold
</x-mail::button>

<x-mail::table>
| | |
|:--|:--|
| Pick-up | {{ $booking->pickupLabel() }} |
| Return | {{ $booking->returnLabel() }} |
| Security deposit | ${{ number_format($booking->deposit_usd) }} refundable hold |
| Reference | {{ $booking->public_id }} |
</x-mail::table>

The hold is not a charge. It is released after the car is returned. Without it we may not be able to hand over the car, so please do this before pickup.

@include('mail.booking.questions')
</x-mail::message>
