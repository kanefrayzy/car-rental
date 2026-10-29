<x-mail::message>
# We can't go ahead with your booking

Hi {{ Str::before($booking->name, ' ') }}, we're sorry: your booking of the {{ $booking->car->full_name }} for {{ $booking->pickup_date->format('M j') }} to {{ $booking->return_date->format('M j, Y') }} has been cancelled.

@if ($ownerMessage)
<x-mail::panel>
{{ $ownerMessage }}
</x-mail::panel>
@endif

@if ($booking->deposit_refunded_at && $booking->deposit_refunded_usd < $booking->deposit_usd)
We refunded ${{ number_format($booking->deposit_refunded_usd, 2) }} of your ${{ number_format($booking->deposit_usd) }} deposit to your card. The rest was kept under our Rental Terms. Depending on your bank it can take 5 to 10 business days to show up.
@elseif ($booking->deposit_refunded_at)
Your ${{ number_format($booking->deposit_refunded_usd, 2) }} deposit has been refunded to your card. Depending on your bank it can take 5 to 10 business days to show up.
@elseif ($booking->deposit_paid_at && $booking->stripe_payment_intent_id)
Your ${{ number_format($booking->deposit_usd) }} deposit was kept under our Rental Terms.
@elseif ($booking->deposit_paid_at)
We will contact you about returning your deposit.
@else
Your card has not been charged.
@endif

@if ($booking->rental_refunded_at)
Your rental payment of ${{ number_format($booking->rental_refunded_usd, 2) }} has been refunded to your card as well.

@endif
You are welcome to request other dates on our website.

@include('mail.booking.questions')

Reference: {{ $booking->public_id }}

</x-mail::message>
