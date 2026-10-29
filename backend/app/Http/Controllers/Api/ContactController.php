<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\ContactRequest;
use App\Mail\ContactMessage;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Symfony\Component\HttpKernel\Exception\TooManyRequestsHttpException;
use Throwable;

/**
 * A question or quote request from the website's contact form, emailed to the business (rental.contact_email)
 * with Reply-To set to the sender, so answering is just "Reply". Five messages per IP address
 * per hour; a message that fails validation does not count.
 */
class ContactController extends Controller
{
    public function store(ContactRequest $request): JsonResponse
    {
        $key = 'contact:'.$request->ip();
        $limit = config('rental.rate_limits.contact_per_hour');

        if (RateLimiter::tooManyAttempts($key, $limit)) {
            throw new TooManyRequestsHttpException(
                RateLimiter::availableIn($key),
                'You have sent several messages already. Call or text us at '.config('rental.business.phone').'.',
            );
        }
        RateLimiter::hit($key, 3600);

        // A bot filled the hidden field: answer as if it worked, send nothing.
        if ($request->isBot()) {
            return response()->json(['sent' => true]);
        }

        try {
            Mail::to(config('rental.contact_email'))->send(new ContactMessage(
                name: $request->fullName(),
                email: strtolower(trim($request->validated('email'))),
                phone: trim($request->validated('phone')),
                occasion: config('rental.contact_topics')[$request->validated('occasion')],
                preferredDates: trim((string) $request->validated('preferredDates')) ?: null,
                body: trim($request->validated('message')),
            ));
        } catch (Throwable $error) {
            report($error);
            throw new HttpException(503, 'We couldn’t send your message. Call or text us at '.config('rental.business.phone').'.');
        }

        return response()->json(['sent' => true]);
    }
}
