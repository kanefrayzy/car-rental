<x-mail::message>
# Your booking is confirmed

Good news, {{ Str::before($booking->name, ' ') }}: the {{ $booking->car->full_name }} is reserved for you.

<x-mail::table>
| | |
|:--|:--|
| Pick-up | {{ $booking->pickupLabel() }} |
| Return | {{ $booking->returnLabel() }} |
@if ($booking->occasion)
| Occasion | {{ $booking->occasionLabel() }} |
@endif
@include('mail.booking.price-rows')
| Refundable deposit | ${{ number_format($booking->deposit_usd) }}{{ $booking->deposit_paid_at ? ', received' : ', due before pickup' }} |
| Reference | {{ $booking->public_id }} |
</x-mail::table>

@if ($booking->rentalDue())
**Next: pay for the rental.** The total of **${{ number_format($booking->totalWithTax(), 2) }}** is due before pickup. Pay by card on your booking page:

<x-mail::button :url="$booking->pageUrl()">
Pay ${{ number_format($booking->totalWithTax(), 2) }}
</x-mail::button>

@endif
@unless ($booking->hasAllDocuments())
**We still need your documents.** Upload your driver’s license and proof of insurance on the same page before pickup.

@unless ($booking->rentalDue())
<x-mail::button :url="$booking->pageUrl()">
Upload documents
</x-mail::button>

@endunless
@endunless
@unless ($booking->rentalDue() || ! $booking->hasAllDocuments())
<x-mail::button :url="$booking->pageUrl()">
Open your booking
</x-mail::button>

@endunless
**At pickup.** We will call or text you at {{ $booking->displayPhone() }} to arrange pickup or delivery. Bring your driver’s license and the credit card in your name.

@include('mail.booking.questions')
</x-mail::message>
