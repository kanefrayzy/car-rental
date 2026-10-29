<?php

namespace App\Filament\Pages;

use App\Enums\BookingStatus;
use App\Filament\Resources\BlockedPeriods\BlockedPeriodResource;
use App\Filament\Resources\Bookings\BookingResource;
use App\Models\BlockedPeriod;
use App\Models\Booking;
use App\Support\RentalTime;
use BackedEnum;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Livewire\Attributes\Url;

/** A month view of bookings and closed dates, so the owner sees at a glance when the car is out. */
class Calendar extends Page
{
    protected string $view = 'filament.pages.calendar';

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCalendarDays;

    protected static ?int $navigationSort = 2;

    /** The month shown, as YYYY-MM. Kept in the address so a reload stays on it. */
    #[Url]
    public string $month = '';

    public function mount(): void
    {
        if (! preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $this->month)) {
            $this->month = $this->today()->format('Y-m');
        }
    }

    public function previousMonth(): void
    {
        $this->month = $this->firstOfMonth()->subMonthNoOverflow()->format('Y-m');
    }

    public function nextMonth(): void
    {
        $this->month = $this->firstOfMonth()->addMonthNoOverflow()->format('Y-m');
    }

    public function thisMonth(): void
    {
        $this->month = $this->today()->format('Y-m');
    }

    protected function getViewData(): array
    {
        $first = $this->firstOfMonth();
        // US calendars start the week on Sunday.
        $gridStart = $first->startOfWeek(CarbonInterface::SUNDAY);
        $gridEnd = $first->endOfMonth()->endOfWeek(CarbonInterface::SATURDAY);

        $events = $this->events($gridStart, $gridEnd);
        $lanes = $this->assignLanes($events);
        $laneCount = $events === [] ? 0 : max($lanes) + 1;

        $weeks = [];
        for ($day = $gridStart; $day->lte($gridEnd); $day = $day->addDay()) {
            $slots = array_fill(0, $laneCount, null);
            foreach ($events as $index => $event) {
                if ($day->betweenIncluded($event['start'], $event['end'])) {
                    $slots[$lanes[$index]] = $event + [
                        'isStart' => $day->equalTo($event['start']),
                        'isEnd' => $day->equalTo($event['end']),
                        // The name is written where a bar starts, and again at the start of each week.
                        'showLabel' => $day->equalTo($event['start']) || $day->dayOfWeek === CarbonInterface::SUNDAY,
                    ];
                }
            }
            // Empty lanes at the bottom of a day are dropped; those above keep bars aligned.
            while ($slots !== [] && end($slots) === null) {
                array_pop($slots);
            }

            $weeks[intdiv((int) $gridStart->diffInDays($day), 7)][] = [
                'date' => $day,
                'inMonth' => $day->month === $first->month,
                'isToday' => $day->equalTo($this->today()),
                'slots' => $slots,
            ];
        }

        $monthEvents = array_values(array_filter(
            $events,
            fn (array $event) => $event['end']->gte($first) && $event['start']->lte($first->endOfMonth()),
        ));

        return [
            'title' => $first->format('F Y'),
            'weekdays' => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
            'weeks' => $weeks,
            'monthEvents' => $monthEvents,
            'isCurrentMonth' => $first->format('Y-m') === $this->today()->format('Y-m'),
        ];
    }

    /**
     * Bookings that still count (not cancelled) and closed dates in the period, oldest first.
     *
     * @return list<array{kind: string, label: string, detail: string, url: string, start: CarbonImmutable, end: CarbonImmutable}>
     */
    private function events(CarbonImmutable $from, CarbonImmutable $to): array
    {
        $bookings = Booking::query()
            ->where('status', '!=', BookingStatus::Cancelled)
            ->overlapping($from, $to)
            ->get()
            ->map(fn (Booking $booking) => [
                'kind' => match (true) {
                    $booking->status === BookingStatus::Confirmed => 'confirmed',
                    $booking->status === BookingStatus::Returned => 'returned',
                    $booking->status === BookingStatus::DepositPaid => 'paid',
                    $booking->holdExpired() => 'expired',
                    default => 'request',
                },
                'label' => $booking->name,
                'detail' => ($booking->holdExpired() ? 'Request, dates no longer held' : $booking->status->getLabel())
                    .', out '.RentalTime::label($booking->pickup_time).', back '.RentalTime::label($booking->return_time),
                'url' => BookingResource::getUrl('view', ['record' => $booking]),
                'start' => $booking->pickup_date,
                'end' => $booking->return_date,
            ]);

        $closed = BlockedPeriod::query()
            ->whereDate('starts_on', '<=', $to->toDateString())
            ->whereDate('ends_on', '>=', $from->toDateString())
            ->get()
            ->map(fn (BlockedPeriod $period) => [
                'kind' => 'closed',
                'label' => $period->note ?: 'Closed',
                'detail' => 'Closed dates',
                'url' => BlockedPeriodResource::getUrl('edit', ['record' => $period]),
                'start' => $period->starts_on,
                'end' => $period->ends_on,
            ]);

        return $bookings->toBase()->merge($closed)
            ->sortBy(fn (array $event) => $event['start']->format('Y-m-d').$event['end']->format('Y-m-d'))
            ->values()
            ->all();
    }

    /**
     * Puts each event on a row ("lane") so that bars running over several days stay on the
     * same row and never overlap. Events must be sorted by start date.
     *
     * @return array<int, int> lane per event index
     */
    private function assignLanes(array $events): array
    {
        $laneEnds = [];
        $lanes = [];

        foreach ($events as $index => $event) {
            $lane = 0;
            while (isset($laneEnds[$lane]) && $laneEnds[$lane]->gte($event['start'])) {
                $lane++;
            }
            $laneEnds[$lane] = $event['end'];
            $lanes[$index] = $lane;
        }

        return $lanes;
    }

    /*
     * Calendar days are plain dates, at midnight in the app's timezone like the booking dates
     * they are compared with. Only "today" is taken from the business's timezone.
     */
    private function firstOfMonth(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat('!Y-m', $this->month);
    }

    private function today(): CarbonImmutable
    {
        return CarbonImmutable::parse(CarbonImmutable::today(config('rental.timezone'))->toDateString());
    }
}
