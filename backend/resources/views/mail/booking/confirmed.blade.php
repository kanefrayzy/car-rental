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
@if ($booking->usesHold())
| Security deposit | ${{ number_format($booking->deposit_usd) }} refundable hold |
@else
| Refundable deposit | ${{ number_format($booking->deposit_usd) }}{{ $booking->deposit_paid_at ? ', received' : ', due before pickup' }} |
@endif
| Reference | {{ $booking->public_id }} |
</x-mail::table>

@if ($booking->usesHold())
@if ($booking->hold_status === \App\Enums\HoldStatus::OnHold)
**Your security deposit.** A ${{ number_format($booking->deposit_usd) }} hold is on your card{{ $booking->card_label ? ' ('.$booking->card_label.')' : '' }} now. Nothing is charged. It's released after the car is returned.
@elseif ($booking->hasSavedCard())
**Your security deposit.** We place a ${{ number_format($booking->deposit_usd) }} hold on your card{{ $booking->card_label ? ' ('.$booking->card_label.')' : '' }} on {{ \App\Models\Booking::etLabel($booking->holdDueAt()) }}, {{ config('rental.deposit.hold_hours_before_pickup') }} hours before pickup. Nothing is charged. It's released after the car is returned.
@else
**Your security deposit.** Save your card on your booking page before pickup. We place a ${{ number_format($booking->deposit_usd) }} hold on it {{ config('rental.deposit.hold_hours_before_pickup') }} hours before pickup. Nothing is charged. It's released after the car is returned.
@endif
If something is owed under the Rental Terms (tolls, tickets, extra miles, late return, fuel or cleaning), we may use part of the hold for it and release the rest.

@endif

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
